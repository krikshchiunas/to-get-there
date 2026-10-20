-- Запросы приложения — в той форме, в какой их строит PostgREST из
-- lib/data/*: строки таблицы плюс вложенные объекты через lateral.
-- Подключается из load.sql, выполняется от имени человека load_1 (RLS).
--
-- Бюджеты — для общего раннера GitHub Actions (2 vCPU), с запасом:
-- запрос, который в них не укладывается, на проде под нагрузкой будет
-- заметен человеку.

-- Лента «Университет» (lib/data/feed.ts → getFeed): идеи вуза зрителя,
-- впереди и не закрытые, с автором, вузом, категорией и числом участников.
select perf.measure('Лента: университет', 150, $q$
  select p.*, a.author, to_jsonb(un) as university, to_jsonb(c) as category,
         (select count(*) from public.post_participants pp where pp.post_id = p.id) as participants
  from public.posts p
  left join lateral (
    select to_jsonb(u) || jsonb_build_object('university', to_jsonb(uu)) as author
    from public.users u join public.universities uu on uu.id = u.university_id
    where u.id = p.author_id
  ) a on true
  left join public.universities un on un.id = p.university_id
  left join public.categories c on c.id = p.category_id
  where not p.is_closed
    and p.date_start > now() - interval '1 hour'
    and p.university_id = (select university_id from public.users where id = private.current_user_id())
  order by p.date_start
  limit 50
$q$);

-- Так лента работала до 0041: без limit, все будущие идеи вуза разом.
-- Бюджет только для отчёта — запрос оставлен, чтобы видеть разницу.
select perf.measure('До: лента без limit', 100000, $q$
  select p.*, a.author,
         (select count(*) from public.post_participants pp where pp.post_id = p.id) as participants
  from public.posts p
  left join lateral (
    select to_jsonb(u) as author from public.users u where u.id = p.author_id
  ) a on true
  where not p.is_closed
    and p.date_start > now() - interval '1 hour'
    and p.university_id = (select university_id from public.users where id = private.current_user_id())
  order by p.date_start
$q$);

-- Лента «Подписки»: те же идеи, но от тех, на кого подписан зритель (300 человек).
select perf.measure('Лента: подписки', 150, $q$
  select p.*, a.author,
         (select count(*) from public.post_participants pp where pp.post_id = p.id) as participants
  from public.posts p
  left join lateral (
    select to_jsonb(u) as author from public.users u where u.id = p.author_id
  ) a on true
  where not p.is_closed
    and p.date_start > now() - interval '1 hour'
    and p.author_id in (select f.following_id from public.follows f where f.follower_id = private.current_user_id())
  order by p.date_start
  limit 50
$q$);

-- Так считались подписки до 0041: все строки follows для 50 авторов — в
-- приложение, подсчёт в JS (а PostgREST отдаёт не больше 1 000 строк).
select perf.measure('До: подписки строками', 100000, $q$
  select f.following_id from public.follows f
  where f.following_id = any(array(
    select ('00000000-0000-4000-8000-' || lpad(to_hex(i), 12, '0'))::uuid from generate_series(2, 51) i))
$q$);

-- Счётчики подписок для 50 авторов ленты одним запросом (get_follow_counts, 0041).
select perf.measure('Счётчики подписок: 50 авторов', 80, $q$
  select * from public.get_follow_counts(array(
    select ('00000000-0000-4000-8000-' || lpad(to_hex(i), 12, '0'))::uuid from generate_series(2, 51) i))
$q$);

-- Чат «горячей» идеи (lib/data/posts.ts → getMessages): последние 300 из 20 000.
select perf.measure('Чат: 300 последних из 20 000', 150, $q$
  select m.*, to_jsonb(u) as author
  from public.messages m
  left join public.users u on u.id = m.author_id
  where m.post_id = '00000000-0000-4000-9000-000000000001'
  order by m.created_at desc
  limit 300
$q$);

-- Состав чата той же идеи: 2 000 участников с профилями.
select perf.measure('Участники: 2 000 человек', 250, $q$
  select pp.*, to_jsonb(u) as "user"
  from public.post_participants pp
  left join public.users u on u.id = pp.user_id
  where pp.post_id = '00000000-0000-4000-9000-000000000001'
  order by pp.joined_at
$q$);

-- Поиск идей по слову (lib/data/search.ts → searchPosts).
select perf.measure('Поиск идей: «квиз»', 200, $q$
  select p.*
  from public.posts p
  where not p.is_closed
    and p.date_start > now() - interval '1 hour'
    and (p.title ilike '%квиз%' or p.description ilike '%квиз%'
         or p.geo_city ilike '%квиз%' or p.geo_address ilike '%квиз%')
  order by p.date_start
  limit 500
$q$);

-- Поиск людей (search_people, 0036/0040): по нику и по интересу.
select perf.measure('Поиск людей: ник', 200, $q$
  select * from public.search_people('load_19', 30)
$q$);

select perf.measure('Поиск людей: интерес', 300, $q$
  select * from public.search_people('шахмат', 30)
$q$);

-- Список личных чатов (direct_conversations): 300 собеседников, 6 000 сообщений.
select perf.measure('Личные: список чатов', 250, $q$
  select * from public.direct_conversations order by last_created_at desc
$q$);

-- Переписка с одним собеседником (lib/data/dm.ts): последние 100.
select perf.measure('Личные: переписка', 50, $q$
  select * from public.direct_messages d
  where d.conversation_key = (
    select dm.conversation_key from public.direct_messages dm
    where dm.sender_id = private.current_user_id() limit 1)
  order by d.created_at desc
  limit 100
$q$);

select perf.measure('Личные: непрочитанные', 50, $q$
  select public.unread_direct_total()
$q$);

-- Уведомления (lib/data/notifications.ts): последние 50 из 2 000.
select perf.measure('Уведомления: последние 50', 30, $q$
  select * from public.notifications
  where user_id = private.current_user_id()
  order by created_at desc
  limit 50
$q$);

-- Профиль «звезды» с интересами (PROFILE_FIELDS) и её идеи.
select perf.measure('Профиль с интересами', 30, $q$
  select u.*, to_jsonb(t) as tags
  from public.users u
  left join public.user_tags t on t.user_id = u.id
  where u.nickname = 'load_2'
$q$);

-- Подписчики «звезды»: 5 000 строк (people.ts → getFollowers).
select perf.measure('Подписчики: 5 000', 300, $q$
  select f.created_at, to_jsonb(u) as follower
  from public.follows f
  join public.users u on u.id = f.follower_id
  where f.following_id = '00000000-0000-4000-8000-000000000002'
  order by f.created_at desc
$q$);
