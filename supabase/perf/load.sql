-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Нагрузочный прогон: тяжёлые запросы на десятках тысяч строк          ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Запуск (CI: job database, после pgTAP; локально — после supabase start):
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v ON_ERROR_STOP=1 -f supabase/perf/load.sql
--
-- Всё в одной транзакции и откатывается: база после прогона та же, что до.
--
-- 1. Данные: 20 000 человек, 50 000 идей, ~300 000 участий, 200 000
--    сообщений чатов (20 000 — в одной «горячей» идее), 200 000 подписок
--    (у «звезды» — 5 000 подписчиков), 100 000 личных сообщений, 100 000
--    уведомлений. Триггеры на время генерации выключены
--    (session_replication_role = replica): уведомления, realtime и лимиты
--    к нагрузке запросов на чтение не относятся.
-- 2. Запросы — те же, что шлёт приложение (lib/data/*), от имени обычного
--    пользователя: роль authenticated, JWT, все политики RLS включены.
-- 3. На каждый — EXPLAIN (ANALYZE, BUFFERS) и бюджет времени. Превышение
--    роняет прогон; планы печатаются в лог для docs/PERFORMANCE.md.

\set ON_ERROR_STOP on
\pset pager off
\timing off

begin;

set local session_replication_role = replica;
set local client_min_messages = warning;
select setseed(0.42);

create schema perf;
grant usage on schema perf to authenticated;

create table perf.results (
  ord        serial,
  name       text not null,
  ms         numeric not null,
  budget_ms  numeric not null,
  rows_out   bigint,
  plan       text not null
);
grant all on perf.results to authenticated;
grant usage on sequence perf.results_ord_seq to authenticated;

/* ── данные ────────────────────────────────────────────────────────── */

create temp table uni as
  select id, row_number() over (order by id) as n from public.universities;
create temp table cat as
  select id, row_number() over (order by id) as n from public.categories;

create function pg_temp.uid(i integer) returns uuid language sql immutable as
  $$ select ('00000000-0000-4000-8000-' || lpad(to_hex(i), 12, '0'))::uuid $$;
create function pg_temp.pid(i integer) returns uuid language sql immutable as
  $$ select ('00000000-0000-4000-9000-' || lpad(to_hex(i), 12, '0'))::uuid $$;

-- Люди. 1 — тот, от чьего имени идут запросы; 2 — «звезда».
insert into public.users (id, nickname, university_id, faculty, bio, privacy_settings, created_at)
select pg_temp.uid(i),
       'load_' || i,
       (select id from uni where n = 1 + (i % 8)),
       case when i % 3 = 0 then 'Информатика' when i % 3 = 1 then 'Математика' else null end,
       'Профиль для нагрузочного прогона',
       jsonb_build_object(
         'who_can_message', case when i % 10 = 0 then 'friends' else 'everyone' end,
         'who_can_see_profile', case when i % 20 = 0 then 'friends' when i % 10 = 0 then 'university' else 'everyone' end,
         'who_can_see_interests', case when i % 5 = 0 then 'friends' else 'everyone' end,
         'visible_in_search', i % 10 <> 9,
         'read_receipts', true),
       now() - (i % 700) * interval '1 day'
from generate_series(1, 20000) i;

insert into public.user_tags (user_id, interests, goals)
select pg_temp.uid(i),
       array[(array['Боулдеринг','Шахматы','Техно','Готовка','Бег','Йога','Кино','Футбол','Языки','Настолки'])[1 + i % 10],
             (array['Велосипед','Фотография','Джаз','Походы','Плавание','Аниме','Rust','Python','Театр','Кофе'])[1 + (i / 10) % 10]],
       array['Найти компанию']
from generate_series(1, 20000) i;

insert into public.user_settings (user_id) select pg_temp.uid(i) from generate_series(1, 20000) i;

-- Вход для человека 1: строка auth.users и привязка, как после регистрации.
insert into auth.users (id, instance_id, aud, role, email)
  values ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'load_1@perf.local');
update public.users set auth_user_id = 'aaaaaaaa-0000-4000-8000-000000000001' where id = pg_temp.uid(1);

-- Идеи: 80% впереди (в ленте), остальное прошло; 5% закрыто.
insert into public.posts (id, author_id, university_id, category_id, title, description, date_start,
                          geo_mode, geo_city, geo_address, geo_lat, geo_lng, geo_radius_m,
                          max_participants, chat_access, is_closed, created_at)
select pg_temp.pid(i),
       pg_temp.uid(a.author),
       (select id from uni where n = 1 + (a.author % 8)),
       (select id from cat where n = 1 + (i % 20)),
       (array['Пиво у канала','Квиз в баре','Учебная группа','Пробежка в парке','Настолки вечером',
              'Поход за город','Кино в кампусе','Футбол на площадке','Языковой тандем','Йога на траве'])[1 + i % 10]
         || ' #' || i,
       'Описание идеи номер ' || i || '. Приходи, будет весело.',
       case when i % 5 = 0 then now() - (i % 30) * interval '1 day'
            else now() + ((i * 37) % (60 * 24)) * interval '1 hour' / 24 end,
       case when i % 3 = 0 then 'radius'::public.geo_mode when i % 3 = 1 then 'city'::public.geo_mode else 'area'::public.geo_mode end,
       (array['Берлин','Мюнхен','Гамбург','Кёльн','Ахен','Карлсруэ'])[1 + i % 6],
       case when i % 3 = 2 then 'У входа' else null end,
       case when i % 3 <> 1 then 52.4 + (i % 200) * 0.001 else null end,
       case when i % 3 <> 1 then 13.3 + (i % 300) * 0.001 else null end,
       case when i % 3 = 0 then 2000 else null end,
       case when i % 4 = 0 then 10 else null end,
       (array['everyone','everyone','followers','friends'])[1 + i % 4]::public.chat_access,
       i % 20 = 0,
       now() - (i % 60) * interval '1 day'
from generate_series(1, 50000) i,
     lateral (select 1 + ((i * 7919) % 20000) as author) a;

-- Автор — участник своей идеи (как делает триггер posts_add_author_participant).
insert into public.post_participants (post_id, user_id, joined_at)
select p.id, p.author_id, p.created_at from public.posts p where p.id::text like '00000000-0000-4000-9000-%';

-- Ещё до шести участников на идею.
insert into public.post_participants (post_id, user_id, joined_at)
select distinct on (pg_temp.pid(i), u) pg_temp.pid(i), pg_temp.uid(u), now() - interval '1 hour'
from generate_series(1, 50000) i,
     lateral (select (1 + ((i::bigint * 104729 + k * 7907) % 20000))::integer as u
              from generate_series(1, i % 7) k) j
on conflict (post_id, user_id) do nothing;

-- «Горячая» идея 1: 2 000 участников (человек 1 среди них) и 20 000 сообщений.
update public.posts set max_participants = null, is_closed = false, chat_access = 'everyone',
                        date_start = now() + interval '2 days'
 where id = pg_temp.pid(1);
insert into public.post_participants (post_id, user_id, joined_at)
select pg_temp.pid(1), pg_temp.uid(u), now() - interval '1 day'
from generate_series(1, 2000) u
on conflict (post_id, user_id) do nothing;

insert into public.messages (post_id, author_id, content, created_at)
select pg_temp.pid(1), pg_temp.uid(1 + (i % 2000)), 'Сообщение ' || i, now() - (20000 - i) * interval '10 seconds'
from generate_series(1, 20000) i;

-- Остальные 180 000 сообщений — по участникам их идей.
insert into public.messages (post_id, author_id, content, created_at)
select pp.post_id, pp.user_id, 'Привет из чата', now() - (row_number() over ()) * interval '1 second'
from public.post_participants pp
where pp.post_id <> pg_temp.pid(1)
limit 180000;

-- Подписки: 200 000 случайных, человек 1 читает 300 человек, у «звезды» (2) — 5 000 подписчиков.
-- Десять подписок у каждого: на соседей со сдвигом 1, 38, 75 … — пары не
-- повторяются и не бывают на себя.
insert into public.follows (follower_id, following_id, created_at)
select pg_temp.uid(1 + i % 20000), pg_temp.uid(1 + (i % 20000 + 1 + (i / 20000) * 37) % 20000),
       now() - (i % 400) * interval '1 hour'
from generate_series(0, 199999) i
on conflict (follower_id, following_id) do nothing;
insert into public.follows (follower_id, following_id)
select pg_temp.uid(1), pg_temp.uid(u) from generate_series(2, 301) u
on conflict (follower_id, following_id) do nothing;
insert into public.follows (follower_id, following_id)
select pg_temp.uid(u), pg_temp.uid(2) from generate_series(3, 5002) u
on conflict (follower_id, following_id) do nothing;

-- Личные: у человека 1 — 300 собеседников по 20 сообщений, остальное между другими.
insert into public.direct_messages (sender_id, receiver_id, content, created_at)
select case when k % 2 = 0 then pg_temp.uid(1) else pg_temp.uid(p) end,
       case when k % 2 = 0 then pg_temp.uid(p) else pg_temp.uid(1) end,
       'Личное ' || k, now() - (p * 20 + k) * interval '1 minute'
from generate_series(2, 301) p, generate_series(1, 20) k;
insert into public.direct_messages (sender_id, receiver_id, content, created_at)
select pg_temp.uid(2 + i % 19000), pg_temp.uid(2 + (i * 31 + 1) % 19000), 'Привет', now() - i * interval '1 minute'
from generate_series(1, 94000) i
where i % 19000 <> (i * 31 + 1) % 19000;

-- Уведомления: 2 000 у человека 1, остальные — у других.
insert into public.notifications (user_id, type, payload, is_read, created_at)
select pg_temp.uid(case when i <= 2000 then 1 else 2 + i % 19000 end), 'new_follower',
       jsonb_build_object('actor_id', pg_temp.uid(2 + i % 300)), i % 3 = 0, now() - i * interval '1 minute'
from generate_series(1, 100000) i;

-- Немного блокировок — политики их проверяют на каждой строке.
insert into public.user_blocks (blocker_id, blocked_id)
select pg_temp.uid(1 + i * 37), pg_temp.uid(1 + i * 53) from generate_series(1, 300) i
on conflict do nothing;

set local session_replication_role = origin;
analyze public.users, public.user_tags, public.user_settings, public.posts, public.post_participants,
        public.messages, public.follows, public.direct_messages, public.notifications, public.user_blocks;

select
  (select count(*) from public.users) as "люди",
  (select count(*) from public.posts) as "идеи",
  (select count(*) from public.post_participants) as "участия",
  (select count(*) from public.messages) as "сообщения",
  (select count(*) from public.follows) as "подписки",
  (select count(*) from public.direct_messages) as "личные",
  (select count(*) from public.notifications) as "уведомления";

/* ── замер ─────────────────────────────────────────────────────────── */

-- Тёплый прогон, затем EXPLAIN ANALYZE: в бюджет идёт время выполнения
-- без первого чтения с диска — так, как запрос живёт на проде.
create function perf.measure(name text, budget_ms numeric, q text) returns void
language plpgsql security invoker as $$
declare
  plan json;
  text_plan text := '';
  line text;
begin
  execute q;
  execute 'explain (analyze, buffers, format json) ' || q into plan;
  for line in execute 'explain (analyze, buffers, costs off, timing off, summary off) ' || q loop
    text_plan := text_plan || line || E'\n';
  end loop;
  insert into perf.results (name, ms, budget_ms, rows_out, plan)
  values (name, round((plan -> 0 ->> 'Execution Time')::numeric, 1), budget_ms,
          (plan -> 0 -> 'Plan' ->> 'Actual Rows')::bigint, text_plan);
end;
$$;
grant execute on function perf.measure(text, numeric, text) to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","email":"load_1@perf.local"}', true);
set local role authenticated;

\o /dev/null
\i supabase/perf/queries.sql
\o

reset role;

/* ── отчёт ─────────────────────────────────────────────────────────── */

\pset format aligned
select name as "запрос", ms as "мс", budget_ms as "бюджет", rows_out as "строк",
       case when ms <= budget_ms then 'ok' else 'ПРЕВЫШЕН' end as "итог"
from perf.results order by ord;

\pset format unaligned
\pset tuples_only on
select E'\n━━ ' || name || ' — ' || ms || ' мс\n' || plan from perf.results order by ord;
\pset tuples_only off
\pset format aligned

do $$
declare
  over text;
begin
  select string_agg(name || ' ' || ms || ' мс > ' || budget_ms, '; ') into over
  from perf.results where ms > budget_ms;
  if over is not null then
    raise exception 'Бюджет времени превышен: %', over;
  end if;
end;
$$;

rollback;
