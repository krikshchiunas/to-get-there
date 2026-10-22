-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Правка идеи: только автор, места, уведомление участникам (0037)      ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Идея 02 — автор mira.hv (03), участники 01, 05, 07 и сама mira.

begin;
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.login_as(member uuid) returns void
language plpgsql as $$
declare
  account uuid;
  session uuid := gen_random_uuid();
begin
  select u.auth_user_id into account from public.users u where u.id = member;
  if account is null then
    account := gen_random_uuid();
    set local session_replication_role = replica;
    insert into auth.users (id, instance_id, aud, role, email)
      values (account, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              account::text || '@tests.local');
    update public.users set auth_user_id = account where id = member;
    set local session_replication_role = origin;
  end if;
  -- Живая сессия, как у токена от Supabase Auth: без неё current_user_id()
  -- считает зрителя вышедшим (0043).
  insert into auth.sessions (id, user_id, created_at, updated_at) values (session, account, now(), now());
  perform set_config('request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated', 'email', account::text || '@tests.local',
                      'session_id', session)::text, true);
  execute 'set local role authenticated';
end;
$$;

select plan(7);

select tests.login_as('33333333-3333-3333-3333-000000000005');
select results_eq(
  $$with changed as (update public.posts set title = 'чужая правка'
                     where id = '44444444-4444-4444-4444-000000000002' returning 1)
    select count(*)::int from changed$$,
  $$values (0)$$, 'чужую идею не изменить');
reset role;

select tests.login_as('33333333-3333-3333-3333-000000000003');
select throws_ok($$update public.posts set max_participants = 2 where id = '44444444-4444-4444-4444-000000000002'$$,
  '23514', null, 'мест не может стать меньше, чем вступило');
select throws_ok($$update public.posts set author_id = '33333333-3333-3333-3333-000000000005'
                   where id = '44444444-4444-4444-4444-000000000002'$$,
  '42501', null, 'автора идеи не подменить');
select lives_ok($$update public.posts set title = 'Учебная группа: новое название'
                  where id = '44444444-4444-4444-4444-000000000002'$$,
  'автор меняет название');
reset role;

select is((select count(*)::int from public.notifications where type = 'post_updated'), 0,
  'новое название — не повод будить участников');

select tests.login_as('33333333-3333-3333-3333-000000000003');
select lives_ok($$update public.posts set date_start = date_start + interval '1 hour', geo_city = 'Potsdam'
                  where id = '44444444-4444-4444-4444-000000000002'$$,
  'автор переносит время и место');
reset role;

select results_eq(
  $$select count(*)::int from public.notifications
    where type = 'post_updated' and payload ->> 'changed' = 'time_place'$$,
  $$select (count(*) - 1)::int from public.post_participants
    where post_id = '44444444-4444-4444-4444-000000000002'$$,
  'каждый участник, кроме автора, узнал о переносе');

select * from finish();
rollback;
