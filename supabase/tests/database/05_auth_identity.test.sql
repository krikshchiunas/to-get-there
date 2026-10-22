-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Аккаунт и профиль: открытая регистрация, самовосстановление, лимиты  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- 0043: регистрация открыта любой почте, вуз — по домену и только если он
-- совпал; профиль создаётся одной функцией и восстанавливается сам;
-- удалить профиль можно только вместе с аккаунтом; лимиты попыток входа —
-- только у сервера приложения (service_role). Плюс то, что не должен уметь
-- обычный пользователь: повысить себе права, писать и читать чужое.
--
-- Аккаунты создаются вставкой в auth.users — так же, как это делает
-- GoTrue: срабатывает настоящий триггер регистрации.

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
    json_build_object('sub', account, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Вход аккаунтом напрямую — для аккаунта, у которого профиля нет.
create or replace function tests.login_account(account uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Регистрация так, как её делает GoTrue: строка в auth.users.
create or replace function tests.sign_up(account uuid, address text) returns void
language sql as $$
  insert into auth.users (id, instance_id, aud, role, email)
  values (account, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address);
$$;

select plan(41);

/* ── открытая регистрация ──────────────────────────────────────────── */

select tests.sign_up('aaaaaaaa-0000-4000-8000-0000000000a1', 'Max.Mustermann+tgt@gmail.com');
select is((select count(*)::int from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 1,
  'почта не вуза: профиль создан, регистрация не отклонена');
select is((select university_id from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), null,
  'вуз не назначен — домен не из справочника');
select is((select nickname from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  'max.mustermanntgt', 'ник — из адреса, по правилам ника');
select is((select count(*)::int from public.user_tags t join public.users u on u.id = t.user_id
           where u.auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1')
        + (select count(*)::int from public.user_settings s join public.users u on u.id = s.user_id
           where u.auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 2,
  'вместе с профилем — строки интересов и настроек (0040)');

select tests.sign_up('aaaaaaaa-0000-4000-8000-0000000000a2', 'lena@tu-berlin.de');
select is((select university_id from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a2'),
  '11111111-1111-1111-1111-000000000001'::uuid, 'домен вуза — вуз подставлен, как и раньше');

select tests.sign_up('aaaaaaaa-0000-4000-8000-0000000000a3', 'max.mustermann.tgt@outlook.com');
select tests.sign_up('aaaaaaaa-0000-4000-8000-0000000000a4', 'Max.Mustermann-tgt@web.de');
select is((select count(distinct nickname)::int from public.users
           where auth_user_id in ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a4')), 2,
  'совпавший ник получает суффикс, а не отказ в регистрации');

select tests.sign_up('aaaaaaaa-0000-4000-8000-0000000000a5', '__@example.org');
select ok((select nickname ~ '^[a-z0-9][a-z0-9._]{2,23}$' from public.users
           where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a5'),
  'из адреса без букв всё равно выходит допустимый ник');

select is(private.create_profile_for('aaaaaaaa-0000-4000-8000-0000000000a1', 'other@example.org'),
  (select id from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  'повторный вызов возвращает тот же профиль, второго не создаёт');

/* ── вход без профиля — профиль восстанавливается ──────────────────── */

delete from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a3';
select tests.login_account('aaaaaaaa-0000-4000-8000-0000000000a3');
select ok(public.ensure_my_profile() is not null, 'ensure_my_profile создаёт пропавший профиль');
select is(public.ensure_my_profile(),
  (select id from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a3'),
  'и при повторе возвращает тот же');
select throws_ok($$delete from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a3'$$,
  '42501', null, 'свой профиль не удалить мимо удаления аккаунта');
reset role;
select is((select count(*)::int from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a3'), 1,
  'профиль на месте');

set local role anon;
select throws_ok('select public.ensure_my_profile()', '42501', null, 'аноним профиль не создаёт');
select throws_ok('select count(*) from public.user_tags', '42501', null, 'аноним не читает интересы');
select throws_ok('select count(*) from public.user_settings', '42501', null, 'аноним не читает настройки');
select throws_ok('select count(*) from public.notifications', '42501', null, 'аноним не читает уведомления');
select throws_ok($$select * from public.search_people('mara')$$, '42501', null, 'аноним не ищет людей');
select throws_ok($$select public.auth_attempt('sign_in', 'k', 'k')$$, '42501', null,
  'аноним не трогает лимиты входа');
reset role;

/* ── вуз необязателен — правила видимости прежние ──────────────────── */

select tests.login_as((select id from public.users where auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'));
select is((select count(*)::int from public.users where id = '33333333-3333-3333-3333-000000000008'), 0,
  'без вуза профиль «только мой вуз» не виден');
select is((select count(*)::int from public.users where id = '33333333-3333-3333-3333-000000000001'), 1,
  'открытый профиль виден');
select lives_ok($$insert into public.posts (author_id, category_id, title, description, date_start, geo_mode, geo_city)
                  select u.id, '22222222-2222-2222-2222-000000000001', 'Идея без вуза', 'Проверка',
                         now() + interval '2 days', 'city', 'Берлин'
                  from public.users u where u.auth_user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'$$,
  'человек без вуза создаёт идею');
select throws_ok($$select public.auth_attempt('sign_in', 'k', 'k')$$, '42501', null,
  'вошедший не трогает лимиты входа');
select throws_ok($$select count(*) from private.auth_attempts$$, '42501', null, 'и не читает журнал попыток');
reset role;

select is((select university_id from public.posts where title = 'Идея без вуза'), null,
  'идея берёт вуз автора — его нет');

select tests.login_as('33333333-3333-3333-3333-000000000015');
select is((select count(*)::int from public.posts where title = 'Идея без вуза'), 1,
  'идея без вуза видна другим вошедшим');
select is((select count(*)::int from public.post_cards where title = 'Идея без вуза'), 1,
  'и есть в карточках идей (left join вуза)');
reset role;

/* ── повышение прав и чужие данные ─────────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000011');
select throws_ok($$update public.users set university_id = '11111111-1111-1111-1111-000000000002'
                   where id = '33333333-3333-3333-3333-000000000011'$$,
  '42501', null, 'свой вуз не сменить');
select throws_ok($$update public.users set auth_user_id = gen_random_uuid()
                   where id = '33333333-3333-3333-3333-000000000011'$$,
  '42501', null, 'привязку к аккаунту не сменить');
select throws_ok($$insert into public.posts (author_id, category_id, title, description, date_start, geo_mode, geo_city)
                   values ('33333333-3333-3333-3333-000000000001', '22222222-2222-2222-2222-000000000001',
                           'От чужого имени', '', now() + interval '1 day', 'city', 'Берлин')$$,
  '42501', null, 'идею от чужого имени не создать');
select results_eq($$with changed as (
                      update public.posts set title = 'Взлом'
                      where author_id = '33333333-3333-3333-3333-000000000003' returning 1)
                    select count(*)::int from changed$$,
  $$values (0)$$, 'чужую идею не изменить');
select throws_ok($$insert into public.post_moderators (post_id, user_id, permissions)
                   select p.id, '33333333-3333-3333-3333-000000000011',
                          '{"can_post_media":true,"can_pin":true,"can_poll":true,"can_kick":true}'::jsonb
                   from public.posts p where p.author_id = '33333333-3333-3333-3333-000000000003' limit 1$$,
  '42501', null, 'себя модератором чужой идеи не назначить');
select throws_ok($$update public.reports set status = 'dismissed'$$, '42501', null,
  'жалобы не разобрать — это работа модерации');
select is((select count(*)::int from public.notifications where user_id = '33333333-3333-3333-3333-000000000001'), 0,
  'чужие уведомления не видны');
select is((select count(*)::int from public.direct_messages
           where sender_id <> '33333333-3333-3333-3333-000000000011'
             and receiver_id <> '33333333-3333-3333-3333-000000000011'), 0,
  'чужая личная переписка не видна');
select results_eq($$with changed as (
                      update public.user_settings set notification_settings = notification_settings
                      where user_id = '33333333-3333-3333-3333-000000000001' returning 1)
                    select count(*)::int from changed$$,
  $$values (0)$$, 'чужие настройки не изменить');
reset role;

/* ── лимиты попыток — только сервер приложения ─────────────────────── */

select results_eq($$select public.auth_attempt('password_reset', 'ip-a', 'mail-a') from generate_series(1, 5)$$,
  $$values (0), (0), (0), (0), (0)$$, 'пять писем сброса на одну почту за час — можно');
select cmp_ok(public.auth_attempt('password_reset', 'ip-a', 'mail-a'), '>', 0,
  'шестое — нет, с ответом «через сколько секунд»');
select is(public.auth_attempt('password_reset', 'ip-a', 'mail-b'), 0, 'другая почта с того же адреса — можно');
select results_eq($$select public.auth_attempt('resend_confirmation', null, 'mail-c') from generate_series(1, 5)$$,
  $$values (0), (0), (0), (0), (0)$$, 'без IP правила по почте работают: пять повторных писем можно');
select cmp_ok(public.auth_attempt('resend_confirmation', null, 'mail-c'), '>', 0,
  'а шестое — нет: неизвестный IP не отключает лимит по почте');
select throws_ok($$select public.auth_attempt('drop_tables', 'ip', 'mail')$$, '22023', null,
  'неизвестная операция — ошибка, а не тихий пропуск');

select * from finish();
rollback;
