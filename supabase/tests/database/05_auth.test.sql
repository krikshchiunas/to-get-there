-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Вход: регистрация, профиль, живые сессии, повышение прав (0043–0044) ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Регистрация здесь — вставка в auth.users, как её делает Supabase Auth:
-- срабатывает тот же триггер on_auth_user_created. Вход — JWT с
-- session_id настоящей строки auth.sessions, как у токена из Auth.
-- Всё в одной транзакции и откатывается.

begin;
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Новый аккаунт «через Auth»: профиль создаёт триггер регистрации.
create or replace function tests.sign_up(address text) returns uuid
language plpgsql as $$
declare
  account uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email)
    values (account, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address);
  return account;
end;
$$;

-- Войти аккаунтом: новая живая сессия и JWT с её id.
create or replace function tests.sign_in(account uuid) returns uuid
language plpgsql as $$
declare
  session uuid := gen_random_uuid();
begin
  insert into auth.sessions (id, user_id, created_at, updated_at) values (session, account, now(), now());
  perform set_config('request.jwt.claims',
    json_build_object('sub', account, 'role', 'authenticated', 'session_id', session)::text, true);
  execute 'set local role authenticated';
  return session;
end;
$$;

-- Тот же аккаунт, но JWT с произвольным session_id (или без него).
create or replace function tests.use_token(account uuid, session text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', account, 'role', 'authenticated')
      || case when session is null then '{}'::jsonb else jsonb_build_object('session_id', session) end)::text,
    true);
  execute 'set local role authenticated';
end;
$$;

create table tests.ids (name text primary key, id uuid);
grant select on tests.ids to authenticated;

select plan(43);

/* ── регистрация открыта (0044) ────────────────────────────────────── */

select is((select mode from private.registration_policy), 'open', 'MVP: регистрация открыта');

insert into tests.ids values ('open', tests.sign_up('Someone.Private+tag@gmail.com'));
insert into tests.ids select 'open_profile', u.id from public.users u where u.auth_user_id = (select id from tests.ids where name = 'open');
select is((select count(*)::int from public.users where auth_user_id = (select id from tests.ids where name = 'open')), 1,
  'адрес вне вузов получает профиль в той же транзакции, что и аккаунт');
select is((select university_id from public.users where auth_user_id = (select id from tests.ids where name = 'open')), null,
  'вуз не выбирается и не угадывается — у адреса вне вузов его нет');
select matches((select nickname from public.users where auth_user_id = (select id from tests.ids where name = 'open')),
  '^user[0-9a-f]{8}$', 'ник случайный');
select ok((select position('someone' in nickname) = 0 from public.users
           where auth_user_id = (select id from tests.ids where name = 'open')),
  'ник не раскрывает адрес почты');
select is((select count(*)::int from public.user_settings s join public.users u on u.id = s.user_id
           where u.auth_user_id = (select id from tests.ids where name = 'open')), 1,
  'у нового профиля есть и настройки (users_create_companions)');

insert into tests.ids values ('tub', tests.sign_up('student@tu-berlin.de'));
select is((select un.domain from public.users u join public.universities un on un.id = u.university_id
           where u.auth_user_id = (select id from tests.ids where name = 'tub')), 'tu-berlin.de',
  'почта вуза по-прежнему даёт вуз');

insert into public.email_allowlist (email, university_id)
  select 'tester@example.org', u.id from public.universities u where u.domain = 'lmu.de';
insert into tests.ids values ('allow', tests.sign_up('Tester@Example.org'));
select is((select un.domain from public.users u join public.universities un on un.id = u.university_id
           where u.auth_user_id = (select id from tests.ids where name = 'allow')), 'lmu.de',
  'адрес из email_allowlist получает свой вуз, регистр не важен');

/* ── режим «только вузы» (0043) и закрытие по умолчанию ────────────── */

update private.registration_policy set mode = 'university';
select throws_ok($$select tests.sign_up('outsider@gmail.com')$$, 'P0403', null,
  'режим university: аккаунт с чужим доменом не создаётся вовсе');
select lives_ok($$select tests.sign_up('member@tu-berlin.de')$$, 'режим university: почта вуза проходит');
select is(public.signup_allowed('outsider@gmail.com'), false, 'подсказка формы: чужой домен в режиме university');
select is(public.signup_allowed(' Member@TU-Berlin.de '), true, 'подсказка формы: почта вуза, пробелы и регистр не важны');

delete from private.registration_policy;
select throws_ok($$select tests.sign_up('nobody@tu-berlin.de')$$, 'P0403', null,
  'нет строки политики — регистрация закрыта, а не открыта');
insert into private.registration_policy (singleton, mode) values (true, 'open');
select is(public.signup_allowed('anyone@gmail.com'), true, 'режим open: любой адрес');
select is(public.signup_allowed('not-an-address'), false, 'строка без @ — не адрес');

/* ── служебное недоступно клиентам ─────────────────────────────────── */

set local role anon;
select is(public.signup_allowed('anyone@gmail.com'), true, 'аноним может спросить форму регистрации');
select throws_ok('select mode from private.registration_policy', '42501', null, 'аноним не читает политику регистрации');
select throws_ok($$select private.create_profile(gen_random_uuid(), 'x@gmail.com')$$, '42501', null,
  'аноним не создаёт профили');
select throws_ok('select public.ensure_my_profile()', '42501', null, 'ensure_my_profile — только вошедшему');
select throws_ok('select public.claim_reauth_attempt()', '42501', null, 'claim_reauth_attempt — только вошедшему');
reset role;

select tests.sign_in((select id from tests.ids where name = 'open'));
select throws_ok($$update private.registration_policy set mode = 'open'$$, '42501', null,
  'вошедший не переключает регистрацию');
select throws_ok('select count(*) from private.reauth_attempts', '42501', null, 'журнал попыток пароля закрыт');
select throws_ok($$select private.create_profile(gen_random_uuid(), 'x@gmail.com')$$, '42501', null,
  'вошедший не создаёт профили другим');
reset role;

/* ── живая сессия ──────────────────────────────────────────────────── */

insert into tests.ids values ('live', tests.sign_in((select id from tests.ids where name = 'open')));
select is((select count(*)::int from public.users where auth_user_id = (select id from tests.ids where name = 'open')), 1,
  'живая сессия видит свой профиль');
reset role;

select tests.use_token((select id from tests.ids where name = 'open'), null);
select is((select count(*)::int from public.users), 0, 'JWT без session_id — как без входа');
reset role;

select tests.use_token((select id from tests.ids where name = 'open'), 'не-uuid');
select is((select count(*)::int from public.users), 0, 'испорченный session_id не роняет запрос, а закрывает доступ');
reset role;

-- Выход на всех устройствах / смена пароля: Auth удаляет строки сессий.
delete from auth.sessions where id = (select id from tests.ids where name = 'live');
select tests.use_token((select id from tests.ids where name = 'open'), (select id::text from tests.ids where name = 'live'));
select is((select count(*)::int from public.users), 0, 'отозванная сессия больше ничего не читает');
-- author_id — литерал: выборка из users под отозванной сессией пуста, и
-- вставка «ничего» прошла бы молча, ничего не доказав.
select throws_ok($$insert into public.posts (author_id, title, description, category_id, date_start, geo_mode, geo_city, chat_access)
                   select (select id from tests.ids where name = 'open_profile'), 'после выхода', 'не должно сохраниться',
                          c.id, now() + interval '1 day', 'city', 'Berlin', 'everyone'
                   from public.categories c limit 1$$,
  '42501', null, 'отозванная сессия ничего не записывает');
reset role;

-- Сессия с истёкшим сроком (time-box Auth) — тоже не вход.
insert into auth.sessions (id, user_id, created_at, updated_at, not_after)
  values ('0e000000-0000-4000-8000-000000000001', (select id from tests.ids where name = 'open'), now(), now(), now() - interval '1 minute');
select tests.use_token((select id from tests.ids where name = 'open'), '0e000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.users), 0, 'сессия с вышедшим сроком — как без входа');
reset role;

-- Чужая сессия с моим sub: session_id другого аккаунта не подходит.
insert into auth.sessions (id, user_id, created_at, updated_at)
  values ('0e000000-0000-4000-8000-000000000002', (select id from tests.ids where name = 'tub'), now(), now());
select tests.use_token((select id from tests.ids where name = 'open'), '0e000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.users), 0, 'сессия другого аккаунта не открывает мой');
reset role;

/* ── профиль не удаляется в обход аккаунта, но восстанавливается ───── */

select tests.sign_in((select id from tests.ids where name = 'open'));
select throws_ok($$delete from public.users where auth_user_id = (select id from tests.ids where name = 'open')$$,
  '42501', null, 'свой профиль через API не удалить — только delete_my_account()');
reset role;

-- Аккаунт без профиля (например, старше моста регистрации).
delete from public.users where auth_user_id = (select id from tests.ids where name = 'open');
select tests.sign_in((select id from tests.ids where name = 'open'));
select isnt(public.ensure_my_profile(), null, 'ensure_my_profile восстанавливает профиль');
select is(public.ensure_my_profile(),
  (select id from public.users where auth_user_id = (select id from tests.ids where name = 'open')),
  'повторный вызов отдаёт тот же профиль');
select is((select count(*)::int from public.users where auth_user_id = (select id from tests.ids where name = 'open')), 1,
  'дубликатов нет');
reset role;

/* ── повышение прав ────────────────────────────────────────────────── */

select tests.sign_in((select id from tests.ids where name = 'open'));
select throws_ok($$update public.users set university_id = (select id from public.universities limit 1)
                   where auth_user_id = (select id from tests.ids where name = 'open')$$,
  '42501', null, 'вуз себе не назначить');
select throws_ok($$update public.users set auth_user_id = (select id from tests.ids where name = 'tub')
                   where auth_user_id = (select id from tests.ids where name = 'open')$$,
  '42501', null, 'профиль к чужому аккаунту не привязать');
select throws_ok($$insert into public.users (nickname, auth_user_id) values ('fake_profile', gen_random_uuid())$$,
  '42501', null, 'профиль руками не создать — ни себе, ни другому');
select results_eq(
  $$with changed as (update public.users set bio = 'взлом'
                     where auth_user_id = (select id from tests.ids where name = 'tub') returning 1)
    select count(*)::int from changed$$,
  $$values (0)$$, 'чужой профиль не изменить (IDOR)');
select is((select count(*)::int from public.user_settings s join public.users u on u.id = s.user_id
           where u.auth_user_id = (select id from tests.ids where name = 'tub')), 0,
  'чужие настройки не прочитать (IDOR)');
reset role;

/* ── идея человека без вуза ────────────────────────────────────────── */

select tests.sign_in((select id from tests.ids where name = 'open'));
select lives_ok($$insert into public.posts (author_id, title, description, category_id, date_start, geo_mode, geo_city, chat_access)
                  select u.id, 'Идея без вуза', 'Проверка: автор без вуза создаёт идею.', c.id,
                         now() + interval '1 day', 'city', 'Berlin', 'everyone'
                  from public.users u, public.categories c
                  where u.auth_user_id = (select id from tests.ids where name = 'open') limit 1$$,
  'человек без вуза создаёт идею');
select is((select count(*)::int from public.post_cards where title = 'Идея без вуза' and university_id is null), 1,
  'идея без вуза есть в post_cards');
reset role;

/* ── повторный ввод пароля ─────────────────────────────────────────── */

select tests.sign_in((select id from tests.ids where name = 'tub'));
select lives_ok('select public.claim_reauth_attempt(); select public.claim_reauth_attempt(); select public.claim_reauth_attempt();
                 select public.claim_reauth_attempt(); select public.claim_reauth_attempt();',
  'пять попыток пароля за 15 минут — можно');
select throws_ok('select public.claim_reauth_attempt()', 'P0429', null, 'шестая — «слишком часто»');
reset role;

select * from finish();
rollback;
