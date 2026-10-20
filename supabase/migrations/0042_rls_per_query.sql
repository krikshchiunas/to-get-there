-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0042 — политики RLS: контекст зрителя один раз на запрос             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Нагрузочный прогон (supabase/perf, 20 000 человек и 50 000 идей)
-- показал: дорогие не запросы, а политики. Каждая строка заново вызывала
-- private.current_user_id() — поиск профиля по auth.uid() — и функции
-- вроде is_blocked_between() с ещё двумя поисками. Поиск идей по слову
-- проверял так 40 000 строк — 7,5 с; поиск людей — 11 с; 5 000
-- подписчиков — 1,3 с.
--
-- Права не меняются — меняется, когда их считают:
--
--   1. Во всех политиках public вызов private.current_user_id() обёрнут в
--      (select …): Postgres считает его один раз на запрос (InitPlan).
--   2. Политики, которые смотрят на «кто меня заблокировал», «друзья»,
--      «с кем я в одной идее», получают эти множества функциями ниже —
--      тоже один раз на запрос, а на строке остаётся поиск в хеш-таблице.
--   3. Правило видимости профиля читает privacy_settings прямо из
--      проверяемой строки, а не отдельным запросом по её id.
--
-- Тесты прав (supabase/tests/database) проходят без изменений — это и
-- есть проверка, что смысл политик прежний.

/* ── контекст зрителя ──────────────────────────────────────────────── */

-- С кем блокировка в любую сторону: их идеи и сообщения не видны.
create or replace function private.blocked_between_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.current_user_id() as id)
  select b.blocked_id from public.user_blocks b, me where b.blocker_id = me.id
  union
  select b.blocker_id from public.user_blocks b, me where b.blocked_id = me.id;
$$;

-- Кто заблокировал зрителя: их профили ему не видны (свои блокировки
-- видны — чтобы их можно было снять).
create or replace function private.blocked_me_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocker_id from public.user_blocks b
  where b.blocked_id = private.current_user_id();
$$;

-- Друзья — взаимная подписка.
create or replace function private.friend_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.current_user_id() as id)
  select f.following_id
  from public.follows f, me
  where f.follower_id = me.id
    and exists (
      select 1 from public.follows r
      where r.follower_id = f.following_id and r.following_id = me.id
    );
$$;

-- Те, с кем зритель в одной идее: их профили видны всегда (0008).
create or replace function private.co_participant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.current_user_id() as id)
  select distinct pb.user_id
  from me
  join public.post_participants pa on pa.user_id = me.id
  join public.post_participants pb on pb.post_id = pa.post_id;
$$;

create or replace function private.my_university_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.university_id from public.users u where u.id = private.current_user_id();
$$;

revoke all on function private.blocked_between_ids() from public, anon;
revoke all on function private.blocked_me_ids() from public, anon;
revoke all on function private.friend_ids() from public, anon;
revoke all on function private.co_participant_ids() from public, anon;
revoke all on function private.my_university_id() from public, anon;
grant execute on function private.blocked_between_ids() to authenticated;
grant execute on function private.blocked_me_ids() to authenticated;
grant execute on function private.friend_ids() to authenticated;
grant execute on function private.co_participant_ids() to authenticated;
grant execute on function private.my_university_id() to authenticated;

/* ── 1. current_user_id() — один раз на запрос во всех политиках ───── */

do $$
declare
  p record;
  stmt text;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%private.current_user_id()%' or with_check like '%private.current_user_id()%')
  loop
    stmt := format('alter policy %I on public.%I', p.policyname, p.tablename);
    if p.qual is not null then
      stmt := stmt || ' using (' || replace(p.qual, 'private.current_user_id()', '(select private.current_user_id())') || ')';
    end if;
    if p.with_check is not null then
      stmt := stmt || ' with check ('
        || replace(p.with_check, 'private.current_user_id()', '(select private.current_user_id())') || ')';
    end if;
    execute stmt;
  end loop;
end;
$$;

/* ── 2. политики чтения, которые смотрят на других людей ───────────── */

-- Идеи: любой вошедший, кроме тех, с кем блокировка.
alter policy posts_select_signed_in on public.posts
  using (
    (select private.current_user_id()) is not null
    and author_id not in (select private.blocked_between_ids())
  );

-- Сообщения чата: кто может войти в чат идеи, без заблокированных авторов.
alter policy messages_select_chat on public.messages
  using (
    private.can_enter_post_chat(post_id, (select private.current_user_id()))
    and author_id not in (select private.blocked_between_ids())
  );

-- Профиль: свой; чужой — если он не заблокировал зрителя и либо
-- who_can_see_profile это разрешает, либо вы в одной идее (0008).
alter policy users_select_visible on public.users
  using (
    id = (select private.current_user_id())
    or (
      id not in (select private.blocked_me_ids())
      and (
        case privacy_settings ->> 'who_can_see_profile'
          when 'everyone'   then (select private.current_user_id()) is not null
          when 'university' then university_id = (select private.my_university_id())
          when 'friends'    then id in (select private.friend_ids())
          else false
        end
        or id in (select private.co_participant_ids())
      )
    )
  );

-- Интересы (0040): свои; чужие — если виден сам профиль (подзапрос к
-- users идёт под политикой выше) и who_can_see_interests разрешает.
alter policy user_tags_select_allowed on public.user_tags
  using (
    user_id = (select private.current_user_id())
    or exists (
      select 1 from public.users u
      where u.id = user_tags.user_id
        and case u.privacy_settings ->> 'who_can_see_interests'
              when 'everyone'   then true
              when 'university' then u.university_id = (select private.my_university_id())
              when 'friends'    then u.id in (select private.friend_ids())
              else false
            end
    )
  );

/* ── 3. функции, которые звали current_user_id() на каждой строке ──── */

create or replace function public.unread_direct_total()
returns integer
language sql
stable
set search_path = ''
as $$
  with me as (select private.current_user_id() as id)
  select count(*)::integer
  from me
  join public.direct_messages dm on dm.receiver_id = me.id
  left join public.direct_message_reads r on r.user_id = me.id and r.partner_id = dm.sender_id
  where r.read_at is null or dm.created_at > r.read_at;
$$;

create or replace function private.unread_direct_count(partner uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.current_user_id() as id)
  select count(*)::integer
  from me
  join public.direct_messages dm on dm.receiver_id = me.id and dm.sender_id = partner
  left join public.direct_message_reads r on r.user_id = me.id and r.partner_id = partner
  where r.read_at is null or dm.created_at > r.read_at;
$$;

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
    and u.id is distinct from (select private.current_user_id())
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
