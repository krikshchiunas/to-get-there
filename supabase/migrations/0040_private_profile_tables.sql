-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0040 — интересы и настройки уведомлений: граница прав в базе         ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- RLS прячет строки, а не колонки. Пока интересы, цели и настройки
-- уведомлений лежали в public.users, любой, кому виден профиль, мог прочитать
-- их запросом к /rest/v1 — правило who_can_see_interests соблюдал только экран
-- (canSeeInterests), а настройки уведомлений чужих людей были видны всем.
--
-- Теперь у каждой своя таблица и своя политика:
--
--   user_tags      интересы и цели. Видно тому, кому их разрешает показывать
--                  who_can_see_interests, — и только если виден сам профиль
--                  (как и раньше на экране). Поиск по интересам идёт через
--                  ту же политику: скрытые интересы им не найти.
--   user_settings  настройки уведомлений. Видит и меняет только владелец.
--
-- Колонки из users удаляются: второй копии, которую можно забыть защитить,
-- не остаётся.

/* ── таблицы ───────────────────────────────────────────────────────── */

create table if not exists public.user_tags (
  user_id   uuid primary key references public.users (id) on delete cascade,
  interests text[] not null default '{}',
  goals     text[] not null default '{}',
  constraint user_tags_interests_ok check (public.is_tag_array(interests, 20, 40)),
  constraint user_tags_goals_ok     check (public.is_tag_array(goals, 10, 80))
);

create index if not exists user_tags_interests_idx on public.user_tags using gin (interests);

comment on table public.user_tags is
  'Интересы и цели. Видимость — who_can_see_interests владельца (0040).';

create table if not exists public.user_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  notification_settings jsonb not null default
    '{"new_participant":true,"new_message_in_post":true,"new_message_direct":true,"new_follower":true,"new_post_from_following":true,"event_reminder_1h":true,"event_reminder_30m":true}'::jsonb,
  constraint user_settings_notifications_shape check (
    jsonb_typeof(notification_settings) = 'object'
    and notification_settings - array[
      'new_participant', 'new_message_in_post', 'new_message_direct', 'new_follower',
      'new_post_from_following', 'event_reminder_1h', 'event_reminder_30m'
    ] = '{}'::jsonb
    and coalesce(jsonb_typeof(notification_settings -> 'new_participant'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'new_message_in_post'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'new_message_direct'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'new_follower'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'new_post_from_following'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'event_reminder_1h'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'event_reminder_30m'), '') = 'boolean'
  )
);

comment on table public.user_settings is
  'Настройки уведомлений. Только владелец (0040).';

insert into public.user_tags (user_id, interests, goals)
select u.id, u.interests, u.goals from public.users u
on conflict (user_id) do nothing;

insert into public.user_settings (user_id, notification_settings)
select u.id, u.notification_settings from public.users u
on conflict (user_id) do nothing;

-- Новый профиль — сразу с обеими строками: экранам и триггерам не нужно
-- гадать, есть ли они.
create or replace function private.create_profile_companions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_tags (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return null;
end;
$$;

revoke all on function private.create_profile_companions() from public, anon, authenticated;

drop trigger if exists users_create_companions on public.users;
create trigger users_create_companions
  after insert on public.users
  for each row execute function private.create_profile_companions();

/* ── права ─────────────────────────────────────────────────────────── */

alter table public.user_tags enable row level security;
alter table public.user_settings enable row level security;

revoke all on table public.user_tags from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;
grant select, update (interests, goals) on table public.user_tags to authenticated;
grant select, update (notification_settings) on table public.user_settings to authenticated;

create policy user_tags_select_allowed on public.user_tags
  for select to authenticated
  using (
    user_id = private.current_user_id()
    or (
      not private.has_blocked(user_id, private.current_user_id())
      and private.can_see_interests(user_id, private.current_user_id())
      and (
        private.can_see_profile(user_id, private.current_user_id())
        or private.shares_post_with(user_id, private.current_user_id())
      )
    )
  );

create policy user_tags_update_own on public.user_tags
  for update to authenticated
  using (user_id = private.current_user_id())
  with check (user_id = private.current_user_id());

create policy user_settings_select_own on public.user_settings
  for select to authenticated
  using (user_id = private.current_user_id());

create policy user_settings_update_own on public.user_settings
  for update to authenticated
  using (user_id = private.current_user_id())
  with check (user_id = private.current_user_id());

/* ── функции, которые читали старые колонки ────────────────────────── */

create or replace function private.notification_enabled(recipient uuid, setting text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (s.notification_settings ->> setting)::boolean
    from public.user_settings s where s.user_id = recipient
  ), false);
$$;

-- Поиск людей: интересы — через RLS user_tags, то есть только те, что
-- искателю и так разрешено видеть.
create or replace function public.search_people(q text, max_results integer default 30)
returns setof public.users
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    select '%' || replace(replace(replace(lower(btrim(q)), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
           lower(btrim(q)) as raw
  )
  select u.*
  from public.users u, needle n
  where char_length(n.raw) >= 2
    and (u.privacy_settings ->> 'visible_in_search') = 'true'
    and u.id is distinct from private.current_user_id()
    and (
      u.nickname ilike n.pattern
      or coalesce(u.faculty, '') ilike n.pattern
      or exists (
        select 1 from public.user_tags t, unnest(t.interests) i
        where t.user_id = u.id and i ilike n.pattern
      )
      or exists (
        select 1 from public.universities un
        where un.id = u.university_id and un.short_name ilike n.pattern
      )
    )
  order by (u.nickname ilike n.raw || '%') desc, u.nickname
  limit least(greatest(coalesce(max_results, 30), 1), 50);
$$;

-- Выгрузка: профиль вместе с интересами и настройками уведомлений.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  me uuid := private.current_user_id();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'format', 'to-get-there/export@2',
    'account', jsonb_build_object('email', auth.jwt() ->> 'email'),
    'profile', (
      select to_jsonb(u) - 'auth_user_id'
             || jsonb_build_object(
                  'interests', coalesce(t.interests, '{}'),
                  'goals', coalesce(t.goals, '{}'),
                  'notification_settings', s.notification_settings)
      from public.users u
      left join public.user_tags t on t.user_id = u.id
      left join public.user_settings s on s.user_id = u.id
      where u.id = me),
    'ideas', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at)
      from public.posts p where p.author_id = me), '[]'::jsonb),
    'joined_ideas', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', pp.post_id, 'title', p.title, 'joined_at', pp.joined_at)
                       order by pp.joined_at)
      from public.post_participants pp
      left join public.posts p on p.id = pp.post_id
      where pp.user_id = me), '[]'::jsonb),
    'chat_messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
      from public.messages m where m.author_id = me), '[]'::jsonb),
    'polls', coalesce((
      select jsonb_agg(to_jsonb(pl) order by pl.created_at)
      from public.polls pl where pl.created_by = me), '[]'::jsonb),
    'poll_votes', coalesce((
      select jsonb_agg(to_jsonb(v)) from public.poll_votes v where v.user_id = me), '[]'::jsonb),
    'direct_messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id,
               'direction', case when d.sender_id = me then 'sent' else 'received' end,
               'partner', (select u.nickname from public.users u
                           where u.id = case when d.sender_id = me then d.receiver_id else d.sender_id end),
               'content', d.content,
               'media_url', d.media_url,
               'created_at', d.created_at)
             order by d.created_at)
      from public.direct_messages d
      where d.sender_id = me or d.receiver_id = me), '[]'::jsonb),
    'following', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', u.nickname, 'since', f.created_at))
      from public.follows f join public.users u on u.id = f.following_id
      where f.follower_id = me), '[]'::jsonb),
    'followers', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', u.nickname, 'since', f.created_at))
      from public.follows f join public.users u on u.id = f.follower_id
      where f.following_id = me), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', b.blocked_id, 'since', b.created_at))
      from public.user_blocks b where b.blocker_id = me), '[]'::jsonb),
    'reports_filed', coalesce((
      select jsonb_agg(jsonb_build_object(
               'target_type', r.target_type, 'target_id', r.target_id,
               'reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at))
      from public.reports r where r.reporter_id = me), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at)
      from public.notifications n where n.user_id = me), '[]'::jsonb),
    'identity_verification', coalesce((
      select jsonb_agg(to_jsonb(vr) order by vr.created_at)
      from public.verification_requests vr where vr.user_id = me), '[]'::jsonb)
  );
end;
$$;

/* ── старые колонки ────────────────────────────────────────────────── */

drop index if exists public.users_interests_idx;
alter table public.users drop constraint if exists users_interests_ok;
alter table public.users drop constraint if exists users_goals_ok;
alter table public.users drop constraint if exists users_notifications_shape;
alter table public.users drop column if exists interests;
alter table public.users drop column if exists goals;
alter table public.users drop column if exists notification_settings;
