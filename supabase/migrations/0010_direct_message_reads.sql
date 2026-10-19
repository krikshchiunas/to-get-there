-- ============================================================================
-- 0010 — прочитанность личных сообщений
--
-- UI показывает счётчик непрочитанных в списке чатов и точку в навигации
-- (ConversationView.unread_count, lib/mock/dms.ts), но посчитать его в базе
-- было нечем: в direct_messages нет отметки о прочтении. Храним одну строку
-- на пару «читатель — собеседник» с моментом, до которого прочитано, — это
-- дешевле, чем отметка на каждом сообщении, и ровно то, что нужно счётчику.
-- ============================================================================

create table if not exists public.direct_message_reads (
  user_id    uuid        not null references public.users (id) on delete cascade,
  partner_id uuid        not null references public.users (id) on delete cascade,
  -- Всё, что собеседник прислал до этого момента, считается прочитанным.
  read_at    timestamptz not null default now(),

  primary key (user_id, partner_id),
  constraint direct_message_reads_not_self check (user_id <> partner_id)
);

comment on table public.direct_message_reads is
  'До какого момента пользователь прочитал переписку с конкретным собеседником.';

-- Счётчик в навигации складывает непрочитанное по всем собеседникам сразу.
create index if not exists direct_message_reads_user_idx
  on public.direct_message_reads (user_id);


/* ── счётчики ───────────────────────────────────────────────────────── */

-- Читатель берётся из сессии, а не из аргумента. Первая версия принимала
-- `viewer uuid` параметром, была security definer и выдана роли
-- authenticated — то есть любой залогиненный мог подставить чужой id и
-- узнать число непрочитанных у другого человека (IDOR). Подменить сессию
-- нельзя, поэтому аргумент убран.

-- Сообщения от собеседника, пришедшие после отметки о прочтении.
-- Нет строки в direct_message_reads — значит не прочитано ничего.
create or replace function public.unread_direct_count(partner uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.direct_messages dm
  left join public.direct_message_reads r
    on r.user_id = public.current_user_id() and r.partner_id = partner
  where public.current_user_id() is not null
    and dm.sender_id = partner
    and dm.receiver_id = public.current_user_id()
    and (r.read_at is null or dm.created_at > r.read_at);
$$;

create or replace function public.unread_direct_total()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.direct_messages dm
  left join public.direct_message_reads r
    on r.user_id = public.current_user_id() and r.partner_id = dm.sender_id
  where public.current_user_id() is not null
    and dm.receiver_id = public.current_user_id()
    and (r.read_at is null or dm.created_at > r.read_at);
$$;

create or replace function public.mark_conversation_read(partner uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  viewer uuid := public.current_user_id();
begin
  if viewer is null or partner is null or viewer = partner then
    return;
  end if;

  insert into public.direct_message_reads (user_id, partner_id, read_at)
  values (viewer, partner, now())
  on conflict (user_id, partner_id)
    do update set read_at = excluded.read_at;
end;
$$;


/* ── список чатов ───────────────────────────────────────────────────── */

-- Одна строка на собеседника: последнее сообщение, счётчик непрочитанных и
-- можно ли вообще ответить. Повторяет ConversationView из lib/types.ts, то
-- есть заменяет getConversations() из моков одним запросом.
--
-- security_invoker = false: функции внутри уже проверяют права, а строки
-- отбираются по current_user_id(), поэтому чужую переписку представление
-- не отдаст.
create or replace view public.direct_conversations
  with (security_invoker = false)
as
with viewer as (
  select public.current_user_id() as id
),
mine as (
  select
    dm.*,
    case when dm.sender_id = v.id then dm.receiver_id else dm.sender_id end as partner_id
  from public.direct_messages dm
  cross join viewer v
  where v.id is not null
    and (dm.sender_id = v.id or dm.receiver_id = v.id)
),
latest as (
  select distinct on (partner_id) *
  from mine
  order by partner_id, created_at desc
)
select
  l.partner_id,
  l.id           as last_message_id,
  l.sender_id    as last_sender_id,
  l.content      as last_content,
  l.media_url    as last_media_url,
  l.created_at   as last_created_at,
  public.unread_direct_count(l.partner_id) as unread_count,
  public.can_message_user(l.partner_id, (select id from viewer))    as can_reply
from latest l
order by l.created_at desc;

comment on view public.direct_conversations is
  'Список личных чатов текущего пользователя: последнее сообщение, непрочитанные, можно ли ответить.';


/* ── RLS ────────────────────────────────────────────────────────────── */

alter table public.direct_message_reads enable row level security;

revoke all on table public.direct_message_reads from anon, authenticated;
grant select, insert, update on table public.direct_message_reads to authenticated;

-- Отметки о прочтении принадлежат только своему владельцу: ни читать, ни
-- двигать чужие нельзя — иначе можно было бы узнать, прочитали ли тебя.
drop policy if exists direct_message_reads_select_own on public.direct_message_reads;
create policy direct_message_reads_select_own on public.direct_message_reads
  for select
  to authenticated
  using (user_id = public.current_user_id());

drop policy if exists direct_message_reads_insert_own on public.direct_message_reads;
create policy direct_message_reads_insert_own on public.direct_message_reads
  for insert
  to authenticated
  with check (user_id = public.current_user_id());

drop policy if exists direct_message_reads_update_own on public.direct_message_reads;
create policy direct_message_reads_update_own on public.direct_message_reads
  for update
  to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

revoke execute on function public.unread_direct_count(uuid) from public, anon;
revoke execute on function public.unread_direct_total()     from public, anon;
grant execute on function public.unread_direct_count(uuid) to authenticated;
grant execute on function public.unread_direct_total()     to authenticated;
grant execute on function public.mark_conversation_read(uuid)    to authenticated;
grant select on public.direct_conversations to authenticated;
