-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0029 — блокировка                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Как у Instagram и Threads: блокировка невидима для заблокированного и
-- разрывает всё, через что он может до тебя дотянуться.
--
--   A заблокировал B:
--     - B не видит профиль A (A профиль B видит — чтобы разблокировать);
--     - идеи и сообщения в чатах не видны ни A, ни B друг у друга;
--     - B не может написать A, подписаться на A, вступить в идею A —
--       и наоборот: блокировка не даёт A писать тому, кого он заблокировал;
--     - взаимные подписки снимаются сразу;
--     - уведомления, где действует другой, не создаются.
--
-- Решает база: всё проверяют политики и функции из private, приложение
-- только показывает итог.

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

comment on table public.user_blocks is
  'Кто кого заблокировал. Видно только тому, кто заблокировал; заблокированный о блокировке не узнаёт.';

alter table public.user_blocks enable row level security;

revoke all on table public.user_blocks from anon, authenticated;
grant select, insert, delete on table public.user_blocks to authenticated;

create policy user_blocks_select_own on public.user_blocks
  for select to authenticated
  using (blocker_id = private.current_user_id());

create policy user_blocks_insert_own on public.user_blocks
  for insert to authenticated
  with check (blocker_id = private.current_user_id());

create policy user_blocks_delete_own on public.user_blocks
  for delete to authenticated
  using (blocker_id = private.current_user_id());

/* ── помощники ─────────────────────────────────────────────────────── */

create or replace function private.has_blocked(blocker uuid, blocked uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select blocker is not null and blocked is not null and exists (
    select 1 from public.user_blocks b
    where b.blocker_id = blocker and b.blocked_id = blocked
  );
$$;

create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_blocked(a, b) or private.has_blocked(b, a);
$$;

revoke all on function private.has_blocked(uuid, uuid) from public, anon;
revoke all on function private.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function private.has_blocked(uuid, uuid) to authenticated;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated;

/* ── блокировка снимает подписки ───────────────────────────────────── */

-- security definer: подписку B на A удалить сам A не может — по RLS
-- подписку удаляет только подписчик.
create or replace function private.on_user_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows f
  where (f.follower_id = new.blocker_id and f.following_id = new.blocked_id)
     or (f.follower_id = new.blocked_id and f.following_id = new.blocker_id);
  return null;
end;
$$;

revoke all on function private.on_user_block() from public, anon, authenticated;

drop trigger if exists user_blocks_cut_ties on public.user_blocks;
create trigger user_blocks_cut_ties
  after insert on public.user_blocks
  for each row execute function private.on_user_block();

/* ── правила, которые теперь учитывают блокировку ──────────────────── */

-- Писать нельзя ни тому, кто тебя заблокировал, ни тому, кого заблокировал ты.
create or replace function private.can_message_user(target uuid, sender uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when sender is null or target is null or sender = target then false
    when private.is_blocked_between(sender, target) then false
    else coalesce((
      select case u.privacy_settings ->> 'who_can_message'
        when 'everyone' then true
        when 'friends'  then private.are_friends(sender, target)
        when 'nobody'   then false
        else false
      end
      from public.users u where u.id = target
    ), false)
  end;
$$;

-- Вступить в идею нельзя, если с автором блокировка в любую сторону.
create or replace function private.can_join_post(post uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_enter_post_chat(post, member)
     and not private.is_post_member(post, member)
     and coalesce((
       select not p.is_closed
          and (p.max_participants is null or private.participant_count(post) < p.max_participants)
          and not private.is_blocked_between(member, p.author_id)
       from public.posts p where p.id = post
     ), false);
$$;

-- Профиль: тот, кто тебя заблокировал, для тебя исчезает.
alter policy users_select_visible on public.users using (
  id = private.current_user_id()
  or (
    not private.has_blocked(id, private.current_user_id())
    and (
      private.can_see_profile(id, private.current_user_id())
      or private.shares_post_with(id, private.current_user_id())
    )
  )
);

-- Идеи и сообщения: не видны в обе стороны.
alter policy posts_select_signed_in on public.posts using (
  private.current_user_id() is not null
  and not private.is_blocked_between(author_id, private.current_user_id())
);

alter policy messages_select_chat on public.messages using (
  private.can_enter_post_chat(post_id, private.current_user_id())
  and not private.is_blocked_between(author_id, private.current_user_id())
);

alter policy follows_insert_own on public.follows with check (
  follower_id = private.current_user_id()
  and not private.is_blocked_between(following_id, private.current_user_id())
);

/* ── уведомления от заблокированных не создаются ───────────────────── */

-- Одно место вместо правки каждого notify_*: все они кладут того, кто
-- действует, в payload.actor_id.
create or replace function private.drop_blocked_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_blocked_between(new.user_id, private.try_uuid(new.payload ->> 'actor_id')) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function private.drop_blocked_notification() from public, anon, authenticated;

drop trigger if exists notifications_drop_blocked on public.notifications;
create trigger notifications_drop_blocked
  before insert on public.notifications
  for each row execute function private.drop_blocked_notification();
