-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Интересы и настройки уведомлений: граница прав в базе (0040)         ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Правило who_can_see_interests раньше соблюдал только экран: интересы
-- лежали в users, и любой, кому виден профиль, читал их запросом к API.
-- Здесь проверяется, что база сама не отдаёт скрытое — ни выборкой, ни
-- поиском, — а настройки уведомлений видит и меняет только владелец.
--
-- Факты сида: 01 mara_t и 02 jonas_k — друзья (подписаны друг на друга),
-- у mara интерес «Боулдеринг». 15 dennis.k — другой вуз, ни на кого из них
-- не подписан, но профиль mara открыт всем — значит, он его видит.

begin;
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.login_as(member uuid) returns void
language plpgsql as $$
declare
  account uuid;
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
  perform set_config('request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated', 'email', account::text || '@tests.local')::text, true);
  execute 'set local role authenticated';
end;
$$;

select plan(27);

/* ── схема: второй копии в users не осталось ───────────────────────── */

select hasnt_column('public', 'users', 'interests', 'в users нет интересов');
select hasnt_column('public', 'users', 'goals', 'в users нет целей');
select hasnt_column('public', 'users', 'notification_settings', 'в users нет настроек уведомлений');

insert into public.users (id, nickname, university_id)
  values ('33333333-3333-3333-3333-0000000000f1', 'fresh_tester', '11111111-1111-1111-1111-000000000001');
select is((select count(*)::int from public.user_tags where user_id = '33333333-3333-3333-3333-0000000000f1'), 1,
  'новый профиль сразу получает строку интересов');
select is((select notification_settings ->> 'new_follower' from public.user_settings
           where user_id = '33333333-3333-3333-3333-0000000000f1'), 'true',
  'и строку настроек со значениями по умолчанию');

/* ── интересы открыты всем: видны и находятся ──────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000015');
select is((select count(*)::int from public.user_tags where user_id = '33333333-3333-3333-3333-000000000001'), 1,
  'пока интересы открыты, человек из другого вуза их видит');
select ok(exists(select 1 from public.search_people('оулдеринг') where id = '33333333-3333-3333-3333-000000000001'),
  'и находит по интересу');
reset role;

/* ── mara прячет интересы от всех, кроме друзей ────────────────────── */

update public.users
   set privacy_settings = privacy_settings || '{"who_can_see_interests":"friends"}'::jsonb
 where id = '33333333-3333-3333-3333-000000000001';

select tests.login_as('33333333-3333-3333-3333-000000000015');
select is((select count(*)::int from public.users where id = '33333333-3333-3333-3333-000000000001'), 1,
  'профиль по-прежнему виден');
select is((select count(*)::int from public.user_tags where user_id = '33333333-3333-3333-3333-000000000001'), 0,
  'а интересы — нет: база не отдаёт строку');
select ok(not exists(select 1 from public.search_people('оулдеринг') where id = '33333333-3333-3333-3333-000000000001'),
  'скрытый интерес не находится поиском');
select ok(exists(select 1 from public.search_people('mara') where id = '33333333-3333-3333-3333-000000000001'),
  'по нику человек находится как раньше');
select results_eq($$with changed as (
                      update public.user_tags set interests = '{}'
                       where user_id = '33333333-3333-3333-3333-000000000001' returning 1)
                    select count(*)::int from changed$$,
  $$values (0)$$, 'чужие интересы не изменить');
select throws_ok($$insert into public.user_tags (user_id) values ('33333333-3333-3333-3333-000000000001')$$,
  '42501', null, 'строки интересов не вставить вручную');
select throws_ok($$delete from public.user_tags where user_id = '33333333-3333-3333-3333-000000000001'$$,
  '42501', null, 'и не удалить');
reset role;

select is((select cardinality(interests) from public.user_tags where user_id = '33333333-3333-3333-3333-000000000001'),
  5, 'интересы mara на месте');

select tests.login_as('33333333-3333-3333-3333-000000000002');
select is((select count(*)::int from public.user_tags where user_id = '33333333-3333-3333-3333-000000000001'), 1,
  'другу интересы видны');
select ok(exists(select 1 from public.search_people('оулдеринг') where id = '33333333-3333-3333-3333-000000000001'),
  'и другу поиск по интересу их находит');
reset role;

select tests.login_as('33333333-3333-3333-3333-000000000001');
select is((select count(*)::int from public.user_tags where user_id = '33333333-3333-3333-3333-000000000001'), 1,
  'себе интересы видны всегда');
select lives_ok($$update public.user_tags set goals = array['Найти учебную группу']
                  where user_id = '33333333-3333-3333-3333-000000000001'$$,
  'свои цели менять можно');
reset role;

/* ── настройки уведомлений: только владелец ────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000002');
select is((select count(*)::int from public.user_settings where user_id = '33333333-3333-3333-3333-000000000001'), 0,
  'даже друг не видит чужие настройки уведомлений');
select is((select count(*)::int from public.user_settings), 1,
  'видна ровно одна строка — своя');
reset role;

select set_eq($$select user_id from public.user_settings$$,
  $$select id from public.users$$, 'у каждого профиля есть строка настроек');

select tests.login_as('33333333-3333-3333-3333-000000000001');
select lives_ok($$update public.user_settings
                    set notification_settings = notification_settings || '{"new_follower":false}'::jsonb
                  where user_id = '33333333-3333-3333-3333-000000000001'$$,
  'свои настройки менять можно');
select throws_ok($$update public.user_settings
                     set notification_settings = '{"bogus":true}'::jsonb
                   where user_id = '33333333-3333-3333-3333-000000000001'$$,
  '23514', null, 'форма настроек проверяется базой');
select is((public.export_my_data() -> 'profile' -> 'interests') -> 0, '"Боулдеринг"'::jsonb,
  'выгрузка данных содержит интересы');
select is(public.export_my_data() -> 'profile' -> 'notification_settings' -> 'new_follower', 'false'::jsonb,
  'и настройки уведомлений');
reset role;

select is(private.notification_enabled('33333333-3333-3333-3333-000000000001', 'new_follower'), false,
  'уведомления читают настройки из новой таблицы');

select * from finish();
rollback;
