-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Права доступа: кто что видит и что может записать                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Запуск: `supabase test db` (CI: job database). Каждая проверка идёт от
-- имени настоящего пользователя из сида — с ролью authenticated и JWT,
-- как запрос из приложения. Всё в одной транзакции и откатывается.
--
-- Факты сида, на которые опираются проверки:
--   01 mara_t  — участник 02 (модератор: pin, poll, media) и 07
--   03 mira.hv — автор 02          04 ayse_dk — друг elif.s, делит идею с nina__b
--   05 tobi    — участник 02        08 nina__b — профиль «только мой вуз» (TU)
--   11 paul_tm — подписан на jonas_k, не в идее 07
--   12 elif.s  — пишут только друзья; идея 09 «только друзья»
--   13 jan_o   — не принимает сообщения, скрыт из поиска
--   15 dennis.k — другой вуз, ни на кого из этих не подписан
--   идеи: 07 — только подписчики jonas_k, мест нет; 08 — одно место;
--         17 — набор закрыт

begin;
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Войти как человек из сида: завести ему строку auth.users (без триггера
-- моста 0013 — профиль уже есть) и подставить JWT, как это делает PostgREST.
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

select plan(28);

-- В закрытых чатах 07 и 09 по сообщению от автора: иначе «ничего не видно»
-- было бы правдой просто потому, что там пусто.
insert into public.messages (post_id, author_id, content) values
  ('44444444-4444-4444-4444-000000000007', '33333333-3333-3333-3333-000000000002', 'только для подписчиков'),
  ('44444444-4444-4444-4444-000000000009', '33333333-3333-3333-3333-000000000012', 'только для друзей');

/* ── аноним ────────────────────────────────────────────────────────── */

set local role anon;
select throws_ok('select count(*) from public.users', '42501', null, 'аноним не читает профили');
select throws_ok('select count(*) from public.posts', '42501', null, 'аноним не читает идеи');
select throws_ok('select count(*) from public.messages', '42501', null, 'аноним не читает чаты');
select throws_ok('select count(*) from public.direct_messages', '42501', null, 'аноним не читает личку');
select ok((select count(*) from public.universities) > 0, 'аноним видит список вузов — он нужен регистрации');
reset role;

/* ── профили ───────────────────────────────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000015');
select is((select count(*)::int from public.users where id = '33333333-3333-3333-3333-000000000008'), 0,
  'профиль «только мой вуз» не виден студенту другого вуза');
reset role;

select tests.login_as('33333333-3333-3333-3333-000000000004');
select is((select count(*)::int from public.users where id = '33333333-3333-3333-3333-000000000008'), 1,
  'общая идея открывает профиль');
select throws_ok($$update public.users set is_verified = true where id = '33333333-3333-3333-3333-000000000004'$$,
  '42501', null, 'отметку «Личность подтверждена» себе не поставить');
select results_eq(
  $$with changed as (update public.users set bio = 'взлом' where id = '33333333-3333-3333-3333-000000000005' returning 1)
    select count(*)::int from changed$$,
  $$values (0)$$, 'чужой профиль не изменить');
select is((select count(*)::int from public.notifications where user_id <> '33333333-3333-3333-3333-000000000004'), 0,
  'видны только свои уведомления');
select throws_ok($$select private.notification_enabled('33333333-3333-3333-3333-000000000001', 'new_follower')$$,
  '42501', null, 'служебные функции схемы private не вызвать');
reset role;

/* ── чат идеи ──────────────────────────────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000015');
select is((select count(*)::int from public.messages where post_id = '44444444-4444-4444-4444-000000000007'), 0,
  'чат «только подписчики» закрыт для неподписанного');
select is((select count(*)::int from public.messages where post_id = '44444444-4444-4444-4444-000000000009'), 0,
  'чат «только друзья» закрыт для не-друга');
select throws_ok($$insert into public.messages (post_id, author_id, content)
                   values ('44444444-4444-4444-4444-000000000002', '33333333-3333-3333-3333-000000000015', 'привет')$$,
  '42501', null, 'не участник не пишет в чат');
reset role;

select tests.login_as('33333333-3333-3333-3333-000000000001');
select ok((select count(*) from public.messages where post_id = '44444444-4444-4444-4444-000000000007') > 0,
  'участник читает закрытый чат');
select lives_ok($$insert into public.messages (post_id, author_id, content)
                  values ('44444444-4444-4444-4444-000000000002', '33333333-3333-3333-3333-000000000001', 'буду к десяти')$$,
  'участник пишет в чат');
select throws_ok($$insert into public.messages (post_id, author_id, content)
                   values ('44444444-4444-4444-4444-000000000002', '33333333-3333-3333-3333-000000000005', 'от чужого имени')$$,
  '42501', null, 'нельзя писать от чужого имени');
select results_eq(
  $$with gone as (delete from public.messages
                  where post_id = '44444444-4444-4444-4444-000000000002'
                    and author_id = '33333333-3333-3333-3333-000000000005' returning 1)
    select count(*)::int from gone$$,
  $$values (0)$$, 'участник не удаляет чужие сообщения');
reset role;

select tests.login_as('33333333-3333-3333-3333-000000000003');
select results_ne(
  $$with gone as (delete from public.messages
                  where post_id = '44444444-4444-4444-4444-000000000002'
                    and author_id = '33333333-3333-3333-3333-000000000005' returning 1)
    select count(*)::int from gone$$,
  $$values (0)$$, 'автор идеи удаляет любые сообщения в своём чате');
reset role;

/* ── вступление в идею ─────────────────────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000011');
select throws_ok($$insert into public.post_participants (post_id, user_id)
                   values ('44444444-4444-4444-4444-000000000007', '33333333-3333-3333-3333-000000000011')$$,
  '42501', null, 'в идею без мест не вступить');
select throws_ok($$insert into public.post_participants (post_id, user_id)
                   values ('44444444-4444-4444-4444-000000000017', '33333333-3333-3333-3333-000000000011')$$,
  '42501', null, 'в идею с закрытым набором не вступить');
select lives_ok($$insert into public.post_participants (post_id, user_id)
                  values ('44444444-4444-4444-4444-000000000008', '33333333-3333-3333-3333-000000000011')$$,
  'в открытую идею вступить можно');
reset role;

select tests.login_as('33333333-3333-3333-3333-000000000009');
select throws_ok($$insert into public.post_participants (post_id, user_id)
                   values ('44444444-4444-4444-4444-000000000008', '33333333-3333-3333-3333-000000000009')$$,
  '42501', null, 'последнее место занято — следующему отказ');
reset role;

/* ── личные сообщения и подписки ───────────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000015');
select throws_ok($$insert into public.direct_messages (sender_id, receiver_id, content)
                   values ('33333333-3333-3333-3333-000000000015', '33333333-3333-3333-3333-000000000013', 'привет')$$,
  '42501', null, '«никто не пишет» — сообщение не уходит');
select throws_ok($$insert into public.direct_messages (sender_id, receiver_id, content)
                   values ('33333333-3333-3333-3333-000000000015', '33333333-3333-3333-3333-000000000012', 'привет')$$,
  '42501', null, '«только друзья» — не-другу не написать');
select throws_ok($$insert into public.follows (follower_id, following_id)
                   values ('33333333-3333-3333-3333-000000000005', '33333333-3333-3333-3333-000000000004')$$,
  '42501', null, 'нельзя подписать другого человека');
reset role;

select tests.login_as('33333333-3333-3333-3333-000000000004');
select is((select count(*)::int from public.messages where post_id = '44444444-4444-4444-4444-000000000009'), 1,
  'друг автора читает чат «только друзья»');
select lives_ok($$insert into public.direct_messages (sender_id, receiver_id, content)
                  values ('33333333-3333-3333-3333-000000000004', '33333333-3333-3333-3333-000000000012', 'привет')$$,
  'друг пишет тому, кто принимает сообщения только от друзей');
reset role;

select * from finish();
rollback;
