# Этапы

Шесть этапов. Порядок не случайный: сначала интерфейс целиком на моках, потом
база, потом подключение и только в самом конце регистрация — потому что экран
входа, сделанный первым, заставил бы всё остальное объяснять себя через него.

| Этап | Что это | Состояние |
| --- | --- | --- |
| 1 | Фундамент: токены, типы, примитивы, навигация, слой моков | готово |
| 2 | Основной цикл: лента, идея и её чат, создание идеи | готово |
| 3 | Люди: профили, подписки, личные сообщения, поиск, уведомления, настройки | готово |
| 4 | База данных: схема, правила, RLS, realtime, файлы, сид | готово |
| 5 | Подключение: запросы Supabase вместо `lib/mock`, живые обновления, файлы | дальше |
| 6 | Регистрация и вход по университетской почте, верификация личности | в конце |

---

## Этап 1 — фундамент (готово)

- `app/globals.css` — токены цвета, радиусы, шрифты, `u-display`, `u-tnum`,
  `u-rise`, тёмная тема.
- `lib/types.ts` — все типы домена. Строковые типы повторяют схему
  Postgres колонка в колонку, `*View` — строка плюс джойны, которые нужны
  экрану.
- `lib/format.ts` — русские даты и время в берлинском поясе, `pluralRu`,
  правило ленты, места, расстояния.
- `components/ui/*` — примитивы, `components/nav/bottom-nav.tsx` —
  навигация, уже смонтированная в `app/layout.tsx`.
- `lib/mock/*` — данные: 8 университетов, 20 категорий, 15 человек,
  20 идей, чаты, голосования, подписки, личные сообщения, уведомления.
- `docs/ui-contract.md` — правила и глоссарий. Отклоняться нельзя.

## Этап 2 — основной цикл (готово)

Лента как расписание: две вкладки, обе строго по времени, ближайшее первым.
Карточка показывает время, место, свободные места и автора. Экран идеи —
описание, состав, групповой чат, голосования, модерация. Создание идеи —
`/create`.

## Этап 3 — люди (готово)

Профиль `/u/<nickname>`, списки подписчиков и подписок, личные сообщения
`/messages` и `/messages/<nickname>`, поиск с фильтрами, уведомления,
настройки (профиль, приватность, уведомления, верификация).

## Этап 4 — база данных (готово)

`supabase/migrations/0001`–`0009` и `supabase/seed.sql`. Подробно —
`docs/DATABASE.md`. Коротко, что появилось:

- таблицы под все типы из `lib/types.ts`, с ограничениями на форму jsonb;
- функции правил (`can_enter_post_chat`, `are_friends`, `post_role`, …) —
  те же правила, что в `lib/mock/index.ts`, но на стороне базы;
- представления `active_posts` и `post_cards` (правило ленты и всё, что
  нужно карточке, одним запросом);
- триггеры: автор садится в свой чат, университет идеи берётся из профиля,
  никто не выставляет себе `is_verified`, одно закрепление на идею,
  уведомления с проверкой настроек получателя;
- RLS на каждой таблице плюс гранты на отдельные колонки;
- realtime на пять таблиц, три бакета файлов с политиками;
- сид — тот же набор данных, что в `lib/mock`, с относительным временем;
- `lib/supabase/client.ts` и `server.ts` — клиенты для браузера и сервера;
- `supabase/later/auth_bridge.sql` — мост авторизации, отложенный до этапа 6.

Пока база существует рядом с приложением: экраны по-прежнему читают
`lib/mock`, флаг `NEXT_PUBLIC_USE_MOCKS` остаётся `true`, а база в режиме
`app_flags.open_read = true`, в котором чтение разрешено анонимному ключу
(записи — нет).

## Этап 5 — подключение (дальше)

Порядок работ:

1. `supabase start`, `supabase db reset`, `npm run db:types` — типы в
   `lib/database.types.ts`, после чего в оба клиента добавляется дженерик
   `<Database>`.
2. Завести `lib/data/*.ts` с теми же сигнатурами, что у функций
   `lib/mock/index.ts`, и переключать экраны по одному, сверяя с моком.
   Сигнатуры специально уже такие, какими будут: меняется тело, не места
   вызова.
3. Включить живые обновления там, где они уже предусмотрены схемой: чат
   идеи, личная переписка, счётчик голосов, состав чата, значок
   уведомлений.
4. Заменить локальные `// TODO(supabase):` на настоящие записи: отправка
   сообщения, «Присоединиться», голос, закрепление, переключатели настроек.
5. Загрузка файлов: аватар в `avatars`, вложения чата в `post-media`.
6. Убрать `NEXT_PUBLIC_USE_MOCKS` и сам `lib/mock`, когда ни один экран
   его больше не читает.

### Какой вызов какой запрос заменит

Слева — функция из `lib/mock/index.ts`, справа — запрос, который встанет на
её место. `me` ниже — `public.current_user_id()`.

| `lib/mock/index.ts` | Supabase |
| --- | --- |
| `getFeed("university", now)` | `from("post_cards").select("*").eq("university_id", myUniversityId).eq("in_feed", true).order("date_start")` |
| `getFeed("following", now)` | `from("post_cards").select("*, follows!inner(follower_id)").eq("follows.follower_id", me).eq("in_feed", true).neq("author_id", me).order("date_start")` — либо RPC на пару джойнов, см. пример в `docs/DATABASE.md` |
| `getPost(id)` | `from("post_cards").select("*").eq("id", id).maybeSingle()` + `rpc("post_role", { post: id, member: me })` |
| `getActivePostsByAuthor(id, now)` | `from("post_cards").select("*").eq("author_id", id).eq("in_feed", true).order("date_start")` |
| `getPastPostsByAuthor(id, now)` | то же с `.eq("in_feed", false).order("date_start", { ascending: false })` |
| `canEnterChat(post)` | `rpc("can_enter_post_chat", { post, member: me })` — и то же правило уже стоит в политике на `messages` |
| `getParticipants(postId)` | `from("post_participants").select("*, user:users(*), moderator:post_moderators(permissions)").eq("post_id", postId).order("joined_at")` |
| `getRole(postId, userId)` | `rpc("post_role", { post: postId, member: userId })` |
| `getViewerPermissions(postId)` | `from("post_moderators").select("permissions").eq("post_id", postId).eq("user_id", me).maybeSingle()` (автор — все права, см. `can_moderate`) |
| `getMessages(postId)` | `from("messages").select("*, author:users(*)").eq("post_id", postId).order("created_at")` + подписка realtime на `messages` |
| `getPinnedMessage(postId)` | `from("messages").select("*, author:users(*)").eq("post_id", postId).eq("is_pinned", true).maybeSingle()` |
| `getPolls(postId)` | `from("polls").select("*, author:users(*), poll_votes(option_index, user_id)").eq("post_id", postId).order("created_at", { ascending: false })` — `tally` и `viewer_choice` считаются из `poll_votes` |
| `getMyIdeaChats()` | `from("post_participants").select("post:post_cards(*)").eq("user_id", me)` + последнее сообщение каждой идеи |
| `getUserByNickname(nickname)` | `from("users").select("*, university:universities(*)").eq("nickname", nickname).maybeSingle()` + счётчики из `follows` |
| `canSeeProfile(user)` | `rpc("can_see_profile", { target, viewer: me })` — политика на `users` уже прячет строку |
| `canSeeInterests(user)` | `rpc("can_see_interests", { target, viewer: me })` |
| `getFollowers(userId)` | `from("follows").select("follower:users!follows_follower_id_fkey(*)").eq("following_id", userId)` |
| `getFollowing(userId)` | `from("follows").select("following:users!follows_following_id_fkey(*)").eq("follower_id", userId)` |
| `getFriends()` | `rpc`-обёртка над `are_friends`, либо пересечение двух выборок из `follows` |
| `getConversations()` | последняя строка на `conversation_key` из `direct_messages` + `rpc("can_message_user", …)` на каждого партнёра |
| `getThread(partnerId)` | `from("direct_messages").select("*").eq("conversation_key", keyOf(me, partnerId)).order("created_at")` + realtime |
| `canMessage(partner)` | `rpc("can_message_user", { target: partnerId, sender: me })` |
| `getNotifications()` | `from("notifications").select("*").eq("user_id", me).order("created_at", { ascending: false })` + realtime |
| `unreadNotificationCount` | `from("notifications").select("*", { count: "exact", head: true }).eq("user_id", me).eq("is_read", false)` |
| `searchPosts(filters, now)` | `from("post_cards")` + `.eq("in_feed", true)` + `.or("title.ilike.%q%,description.ilike.%q%,geo_city.ilike.%q%")` + фильтры по категории, дате, времени суток, городу; радиус — в SQL-функции или в коде по `geo_lat/geo_lng` |
| `searchUsers(query)` | `from("users").select("*").eq("privacy_settings->>visible_in_search", "true").ilike("nickname", "%q%")` |
| `getCitiesWithPosts()` | `from("active_posts").select("geo_city")` + уникальные значения, либо отдельное представление |
| `getCategory(id)` / `categories` | `from("categories").select("*").order("name")` — справочник, кешируется на всё время сессии |
| `getUniversity(id)` / `universities` | `from("universities").select("*")` — то же |
| `currentUser` | `from("users").select("*, university:universities(*)").eq("id", me).single()` — появляется только на этапе 6 |

Записи, которые заменят локальный state (все помечены в коде как
`// TODO(supabase):`):

| Действие | Запрос |
| --- | --- |
| «Создать идею» | `from("posts").insert({…})` — `university_id` поставит триггер |
| «Присоединиться» | `from("post_participants").insert({ post_id, user_id: me })` |
| Выйти / «Удалить из чата» | `from("post_participants").delete().eq(…)` |
| Отправить сообщение | `from("messages").insert({ post_id, author_id: me, content })` |
| «Закрепить» / «Открепить» | `from("messages").update({ is_pinned }).eq("id", messageId)` |
| Голос | `from("poll_votes").upsert({ poll_id, user_id: me, option_index })` |
| «Закрыть набор» | `from("posts").update({ is_closed: true }).eq("id", postId)` |
| Назначить модератора | `from("post_moderators").insert({ post_id, user_id, permissions })` |
| «Подписаться» / отписаться | `from("follows").insert/delete` |
| «Написать» | `from("direct_messages").insert({ sender_id: me, receiver_id, content })` |
| Настройки приватности и уведомлений | `from("users").update({ privacy_settings })` / `{ notification_settings }` |
| Прочитать уведомление | `from("notifications").update({ is_read: true })` |

## Этап 6 — вход (в конце)

1. Применить `supabase/later/auth_bridge.sql`: триггер на `auth.users`
   создаёт профиль и отказывает адресу, домен которого не числится в
   `public.universities`. Это и есть проверка университетской почты — там,
   где её нельзя обойти.
2. Экраны: регистрация, подтверждение адреса, вход, выход. Письма локально
   ловит Inbucket (`http://127.0.0.1:54324`).
3. `middleware.ts` для обновления сессии — без него серверные компоненты
   будут видеть просроченный токен.
4. `update public.app_flags set open_read = false;` — база становится
   строгой, и дальше всё решает `current_user_id()`.
5. Верификация личности: загрузка документа в бакет `verification`,
   проверка человеком, `is_verified` выставляется service role. Галочка не
   даёт никаких прав — она только сигнал доверия.
6. Напоминания о встрече: `pg_cron` раз в несколько минут пишет
   `event_reminder` по `notification_settings.event_reminder_1h` и
   `event_reminder_30m`. Единственный тип уведомления, у которого нет
   триггера, потому что он зависит от часов, а не от записи.

## Что сознательно отложено

- Непрочитанные личные сообщения: — закрыто миграцией `0010_direct_message_reads.sql`.
  Ранее: `unread_count` сейчас из моков, в схеме
  решения нет (нужна `read_at` или таблица «прочитано до»).
- Жёсткая приватность интересов (политика скрывает строки, не колонки).
- Поиск по радиусу в SQL: пока считается в коде через `distanceMetres`;
  честный вариант — `postgis` или функция на `earthdistance`.
- Пуши в телефон, карта вместо адреса, вторая языковая версия интерфейса.
