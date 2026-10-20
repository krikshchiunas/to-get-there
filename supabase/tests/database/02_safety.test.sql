-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Безопасность сообщества, приватность и свои данные                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Блокировка (0029), жалобы (0030), ограничение частоты (0031), ответы и
-- «Прочитано» (0032), каналы «печатает» (0033), выгрузка и удаление
-- аккаунта (0034–0035), поиск людей (0036), политики Storage (0009).
-- Факты сида — в шапке 01_access.test.sql.

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

select plan(44);

/* ── блокировка: mara_t (01) блокирует jonas_k (02) ────────────────── */

select ok((select count(*) from public.follows
           where (follower_id, following_id) in (
             ('33333333-3333-3333-3333-000000000001'::uuid, '33333333-3333-3333-3333-000000000002'::uuid),
             ('33333333-3333-3333-3333-000000000002'::uuid, '33333333-3333-3333-3333-000000000001'::uuid))) > 0,
  'до блокировки они подписаны друг на друга');

select tests.login_as('33333333-3333-3333-3333-000000000001');
select lives_ok($$insert into public.user_blocks (blocker_id, blocked_id)
                  values ('33333333-3333-3333-3333-000000000001', '33333333-3333-3333-3333-000000000002')$$,
  'заблокировать можно');
select throws_ok($$insert into public.user_blocks (blocker_id, blocked_id)
                   values ('33333333-3333-3333-3333-000000000005', '33333333-3333-3333-3333-000000000002')$$,
  '42501', null, 'нельзя заблокировать от чужого имени');
select is((select count(*)::int from public.users where id = '33333333-3333-3333-3333-000000000002'), 1,
  'заблокировавший видит профиль — чтобы снять блокировку');
select is((select count(*)::int from public.posts where author_id = '33333333-3333-3333-3333-000000000002'), 0,
  'идеи заблокированного скрыты');
reset role;

select is((select count(*)::int from public.follows
           where (follower_id, following_id) in (
             ('33333333-3333-3333-3333-000000000001'::uuid, '33333333-3333-3333-3333-000000000002'::uuid),
             ('33333333-3333-3333-3333-000000000002'::uuid, '33333333-3333-3333-3333-000000000001'::uuid))), 0,
  'блокировка сняла подписки в обе стороны');

insert into public.notifications (user_id, type, payload)
  values ('33333333-3333-3333-3333-000000000001', 'new_follower',
          jsonb_build_object('actor_id', '33333333-3333-3333-3333-000000000002'));
select is((select count(*)::int from public.notifications
           where user_id = '33333333-3333-3333-3333-000000000001'
             and payload ->> 'actor_id' = '33333333-3333-3333-3333-000000000002'
             and type = 'new_follower'
             and created_at > now() - interval '1 minute'), 0,
  'уведомления от заблокированного не создаются');

select tests.login_as('33333333-3333-3333-3333-000000000002');
select is((select count(*)::int from public.users where id = '33333333-3333-3333-3333-000000000001'), 0,
  'заблокированный не видит профиль');
select is((select count(*)::int from public.posts where author_id = '33333333-3333-3333-3333-000000000001'), 0,
  'заблокированный не видит идеи');
select is((select count(*)::int from public.user_blocks), 0, 'о блокировке заблокированный не узнаёт');
select throws_ok($$insert into public.direct_messages (sender_id, receiver_id, content)
                   values ('33333333-3333-3333-3333-000000000002', '33333333-3333-3333-3333-000000000001', 'привет')$$,
  '42501', null, 'заблокированный не пишет');
select throws_ok($$insert into public.follows (follower_id, following_id)
                   values ('33333333-3333-3333-3333-000000000002', '33333333-3333-3333-3333-000000000001')$$,
  '42501', null, 'заблокированный не подписывается');
select throws_ok($$insert into public.post_participants (post_id, user_id)
                   values ('44444444-4444-4444-4444-000000000020', '33333333-3333-3333-3333-000000000002')$$,
  '42501', null, 'заблокированный не вступает в идеи');
reset role;

/* ── жалобы: tobi (05) жалуется на сообщение kwame.o (07) в идее 02 ── */

select tests.login_as('33333333-3333-3333-3333-000000000005');
select lives_ok($$insert into public.reports (target_type, target_id, reason, details)
                  select 'message', m.id, 'spam', '  реклама  ' from public.messages m
                  where m.post_id = '44444444-4444-4444-4444-000000000002'
                    and m.author_id = '33333333-3333-3333-3333-000000000007'
                  limit 1$$,
  'жалоба на сообщение принимается');
select throws_ok($$insert into public.reports (target_type, target_id, reason)
                   select 'message', m.id, 'spam' from public.messages m
                   where m.post_id = '44444444-4444-4444-4444-000000000002'
                     and m.author_id = '33333333-3333-3333-3333-000000000007'
                   limit 1$$,
  '23505', null, 'на одно и то же — одна жалоба');
select throws_ok($$insert into public.reports (target_type, target_id, reason)
                   values ('user', '33333333-3333-3333-3333-000000000005', 'other')$$,
  '23514', null, 'на себя не пожаловаться');
select throws_ok($$insert into public.reports (target_type, target_id, reason)
                   values ('message', gen_random_uuid(), 'spam')$$,
  '23503', null, 'на несуществующее не пожаловаться');
select throws_ok($$insert into public.reports (reporter_id, target_type, target_id, reason)
                   values ('33333333-3333-3333-3333-000000000001', 'user', '33333333-3333-3333-3333-000000000003', 'spam')$$,
  '42501', null, 'автора жалобы не подделать');
select throws_ok($$update public.reports set status = 'dismissed'$$, '42501', null, 'свою жалобу не «закрыть»');
select is((select count(*)::int from public.reports), 1, 'видны только свои жалобы');
reset role;

select is((select snapshot ->> 'content' from public.reports
           where reporter_id = '33333333-3333-3333-3333-000000000005'),
          (select content from public.messages
           where post_id = '44444444-4444-4444-4444-000000000002'
             and author_id = '33333333-3333-3333-3333-000000000007' limit 1),
  'жалоба хранит снимок содержимого');
select is((select details from public.reports where reporter_id = '33333333-3333-3333-3333-000000000005'), 'реклама',
  'пояснение без краевых пробелов');

/* ── ответы ────────────────────────────────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000001');
select throws_ok($$insert into public.messages (post_id, author_id, content, reply_to_id)
                   select '44444444-4444-4444-4444-000000000002', '33333333-3333-3333-3333-000000000001', 'ответ', m.id
                   from public.messages m where m.post_id <> '44444444-4444-4444-4444-000000000002' limit 1$$,
  '23503', null, 'ответить можно только на сообщение этого же чата');
select lives_ok($$insert into public.messages (post_id, author_id, content, reply_to_id)
                  select '44444444-4444-4444-4444-000000000002', '33333333-3333-3333-3333-000000000001', 'ответ', m.id
                  from public.messages m where m.post_id = '44444444-4444-4444-4444-000000000002' limit 1$$,
  'ответ внутри чата принимается');
reset role;

/* ── «Прочитано»: ayse_dk (04) и elif.s (12) ───────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000004');
select lives_ok($$select public.mark_conversation_read('33333333-3333-3333-3333-000000000012')$$, 'отметить прочитанным');
reset role;
select tests.login_as('33333333-3333-3333-3333-000000000012');
select is((select count(*)::int from public.direct_message_reads
           where user_id = '33333333-3333-3333-3333-000000000004'
             and partner_id = '33333333-3333-3333-3333-000000000012'), 1,
  'собеседник видит «Прочитано»');
reset role;
update public.users set privacy_settings = privacy_settings || '{"read_receipts": false}'::jsonb
  where id = '33333333-3333-3333-3333-000000000012';
select tests.login_as('33333333-3333-3333-3333-000000000012');
select is((select count(*)::int from public.direct_message_reads
           where user_id = '33333333-3333-3333-3333-000000000004'
             and partner_id = '33333333-3333-3333-3333-000000000012'), 0,
  'выключил у себя — не видишь и чужие отметки');
reset role;

/* ── поиск людей ───────────────────────────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000015');
select is((select count(*)::int from public.search_people('jan_o')), 0, 'скрытый из поиска не находится');
select is((select count(*)::int from public.search_people('%%')), 0, 'шаблонные символы ищутся как буквы');
select is((select count(*)::int from public.search_people('m')), 0, 'одна буква — не поиск');
select is((select nickname from public.search_people('mira')), 'mira.hv', 'находит по нику');
reset role;

/* ── каналы «печатает» и присутствия ───────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000015');
select set_config('realtime.topic', 'chat:44444444-4444-4444-4444-000000000002', true);
select throws_ok($$insert into realtime.messages (topic, extension, event, payload, private)
                   values ('chat:44444444-4444-4444-4444-000000000002', 'broadcast', 'typing', '{}', true)$$,
  '42501', null, 'не участник не шлёт «печатает» в чат идеи');
reset role;

select tests.login_as('33333333-3333-3333-3333-000000000001');
select set_config('realtime.topic', 'chat:44444444-4444-4444-4444-000000000002', true);
select lives_ok($$insert into realtime.messages (topic, extension, event, payload, private)
                  values ('chat:44444444-4444-4444-4444-000000000002', 'broadcast', 'typing', '{}', true)$$,
  'участник шлёт «печатает»');
select set_config('realtime.topic', 'post:44444444-4444-4444-4444-000000000002', true);
select throws_ok($$insert into realtime.messages (topic, extension, event, payload, private)
                   values ('post:44444444-4444-4444-4444-000000000002', 'broadcast', 'changed', '{}', true)$$,
  '42501', null, 'сигнал базы «изменилось» клиенту не подделать');
select set_config('realtime.topic', 'dm:33333333-3333-3333-3333-000000000003:33333333-3333-3333-3333-000000000005', true);
select throws_ok($$insert into realtime.messages (topic, extension, event, payload, private)
                   values ('dm:33333333-3333-3333-3333-000000000003:33333333-3333-3333-3333-000000000005', 'broadcast', 'typing', '{}', true)$$,
  '42501', null, 'в чужую личку не войти');
reset role;

/* ── хранилище ─────────────────────────────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000001');
select lives_ok($$insert into storage.objects (bucket_id, name)
                  values ('avatars', '33333333-3333-3333-3333-000000000001/11111111-2222-3333-4444-555555555555.webp')$$,
  'аватар — в свою папку');
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('avatars', '33333333-3333-3333-3333-000000000002/11111111-2222-3333-4444-555555555555.webp')$$,
  '42501', null, 'в чужую папку аватаров нельзя');
reset role;

select tests.login_as('33333333-3333-3333-3333-000000000015');
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('post-media', '44444444-4444-4444-4444-000000000002/11111111-2222-3333-4444-555555555555.webp')$$,
  '42501', null, 'без права на медиа фото в чужой чат не положить');
reset role;

/* ── ограничение частоты: tobi (05) в чате 02 ──────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000005');
select lives_ok($q$do $flood$ begin
                    for i in 1..20 loop
                      insert into public.messages (post_id, author_id, content)
                        values ('44444444-4444-4444-4444-000000000002', '33333333-3333-3333-3333-000000000005', 'сообщение ' || i);
                    end loop;
                  end $flood$$q$,
  'двадцать сообщений за минуту — можно');
select throws_ok($$insert into public.messages (post_id, author_id, content)
                   values ('44444444-4444-4444-4444-000000000002', '33333333-3333-3333-3333-000000000005', 'двадцать первое')$$,
  'P0429', null, 'двадцать первое за минуту — «слишком часто»');
reset role;

/* ── свои данные: marta_w (14) ─────────────────────────────────────── */

select tests.login_as('33333333-3333-3333-3333-000000000014');
select is((public.export_my_data() -> 'profile' ->> 'nickname'), 'marta_w', 'выгрузка содержит свой профиль');
select ok(not (public.export_my_data() -> 'profile') ? 'auth_user_id', 'в выгрузке нет служебного auth_user_id');
select lives_ok($$select public.delete_my_account()$$, 'аккаунт удаляется');
reset role;

select is((select count(*)::int from public.users where id = '33333333-3333-3333-3333-000000000014'), 0,
  'после удаления профиля нет');

select * from finish();
rollback;
