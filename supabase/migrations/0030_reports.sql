-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0030 — жалобы                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Пожаловаться можно на человека, идею, сообщение в чате идеи и личное
-- сообщение. Жалоба уходит в очередь модерации — её разбирает команда
-- проекта в панели Supabase (docs/MODERATION.md); через API её не прочитать
-- никому, кроме автора жалобы.
--
-- Снимок. В момент жалобы триггер копирует содержимое цели в snapshot: автор
-- нарушения не должен суметь спрятать его, удалив сообщение до проверки.
-- Копируется только то, что жалующийся и так видел — триггер проверяет это
-- теми же функциями, что RLS.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_target' and typnamespace = 'public'::regnamespace) then
    create type public.report_target as enum ('user', 'post', 'message', 'direct_message');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_reason' and typnamespace = 'public'::regnamespace) then
    create type public.report_reason as enum (
      'spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'impersonation', 'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'report_status' and typnamespace = 'public'::regnamespace) then
    create type public.report_status as enum ('open', 'actioned', 'dismissed');
  end if;
end
$$;

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  target_type public.report_target not null,
  target_id   uuid not null,
  -- Чей это контент: по нему модератор видит повторных нарушителей.
  target_user_id uuid references public.users (id) on delete set null,
  reason      public.report_reason not null,
  details     text,
  snapshot    jsonb not null default '{}'::jsonb,
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_details_len check (details is null or char_length(details) <= 1000),
  constraint reports_once unique (reporter_id, target_type, target_id)
);

create index if not exists reports_open_idx on public.reports (created_at) where status = 'open';
create index if not exists reports_target_user_idx on public.reports (target_user_id);

comment on table public.reports is
  'Очередь модерации. Пишет вошедший пользователь (одна жалоба на цель), читает и разбирает команда проекта в панели.';

alter table public.reports enable row level security;

revoke all on table public.reports from anon, authenticated;
grant select, insert (target_type, target_id, reason, details) on table public.reports to authenticated;

create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (reporter_id = private.current_user_id());

-- Свои жалобы видно — чтобы экран мог сказать «ты уже пожаловался».
create policy reports_select_own on public.reports
  for select to authenticated
  using (reporter_id = private.current_user_id());

/* ── проверка цели и снимок ────────────────────────────────────────── */

create or replace function private.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := private.current_user_id();
  row_data jsonb;
  owner uuid;
begin
  -- Колонки, которых нет в grant, всё равно задаёт только этот триггер.
  new.reporter_id := me;
  new.status := 'open';
  new.resolved_at := null;
  new.details := nullif(btrim(new.details), '');

  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  case new.target_type
    when 'user' then
      select to_jsonb(u) - 'auth_user_id' - 'privacy_settings' - 'notification_settings', u.id
        into row_data, owner
      from public.users u
      where u.id = new.target_id
        and not private.has_blocked(u.id, me)
        and (private.can_see_profile(u.id, me) or private.shares_post_with(u.id, me));

    when 'post' then
      select to_jsonb(p), p.author_id into row_data, owner
      from public.posts p
      where p.id = new.target_id
        and not private.is_blocked_between(p.author_id, me);

    when 'message' then
      select to_jsonb(m), m.author_id into row_data, owner
      from public.messages m
      where m.id = new.target_id
        and private.can_enter_post_chat(m.post_id, me);

    when 'direct_message' then
      select to_jsonb(d), d.sender_id into row_data, owner
      from public.direct_messages d
      where d.id = new.target_id
        and d.receiver_id = me;
  end case;

  if row_data is null then
    raise exception 'report target not found' using errcode = '23503';
  end if;
  if owner = me then
    raise exception 'cannot report yourself' using errcode = '23514';
  end if;

  new.snapshot := row_data;
  new.target_user_id := owner;
  return new;
end;
$$;

revoke all on function private.prepare_report() from public, anon, authenticated;

drop trigger if exists reports_prepare on public.reports;
create trigger reports_prepare
  before insert on public.reports
  for each row execute function private.prepare_report();

/* ── очередь для команды проекта ───────────────────────────────────── */

-- В схеме private: PostgREST её не публикует, видно только в панели.
create or replace view private.moderation_queue as
select
  r.id,
  r.created_at,
  r.status,
  r.reason,
  r.target_type,
  r.target_id,
  target_user.nickname as target_nickname,
  (select count(*) from public.reports same
    where same.target_type = r.target_type and same.target_id = r.target_id) as reports_on_target,
  (select count(*) from public.reports prior
    where prior.target_user_id = r.target_user_id and prior.status = 'actioned') as actioned_against_user,
  reporter.nickname as reporter_nickname,
  r.details,
  r.snapshot
from public.reports r
left join public.users target_user on target_user.id = r.target_user_id
left join public.users reporter on reporter.id = r.reporter_id
order by (r.status = 'open') desc, reports_on_target desc, r.created_at;

revoke all on private.moderation_queue from public, anon, authenticated;

comment on view private.moderation_queue is
  'Открытые жалобы первыми, цели с несколькими жалобами выше. Разбор — docs/MODERATION.md.';
