# Безопасность

Как устроена защита To Get There, чем она проверена и что остаётся сделать
руками в панелях сервисов.

## Модель

Права решает база, а не приложение. Любое действие идёт через клиент
Supabase с сессией пользователя, и политики RLS решают, можно ли. Серверный
код только проверяет форму данных и объясняет отказ по-человечески. Схема —
`docs/ARCHITECTURE.md`.

Исключение одно: вебхук Stripe приходит без сессии и записывает итог
проверки личности функцией `apply_verification_result()` — вызвать её может
только `service_role`.

## Что защищено и чем

| Угроза | Защита | Где |
|---|---|---|
| Чтение без входа | у `anon` нет прав на данные, переключателя «открыть всё» больше нет | 0014, 0028 |
| Чужие строки | RLS на каждой таблице, функции в `private` | 0008 … 0038 |
| Вызов служебных функций через API | схема `private` не публикуется | 0024, 0026, 0035 |
| Запись от чужого имени | `with check (… = current_user_id())`, колонки вне grant | 0008 |
| Себе «Личность подтверждена» | колонка вне grant + триггер | 0007, 0008 |
| Скрытые интересы и чужие настройки уведомлений через API | отдельные таблицы `user_tags` (политика `who_can_see_interests`) и `user_settings` (только владелец) | 0040 |
| Флуд и спам-рассылки | лимиты в базе, SQLSTATE P0429 | 0031 |
| Травля | блокировка в обе стороны, без уведомления заблокированному | 0029 |
| Нарушения правил | жалобы со снимком содержимого, очередь модерации | 0030, `docs/MODERATION.md` |
| Удалить нарушение до проверки | снимок в жалобе | 0030 |
| Исключённый модератор | роль снимается, права требуют членства | 0016 |
| Точка автора в режиме радиуса | огрубляется до ~1 км в базе | 0022 |
| GPS в фото | картинка перерисовывается до загрузки | `lib/upload.ts` |
| Чужой путь в `avatar_url` / `media_url` | только свои пути в Storage; в личке медиа не принимаются | `lib/media.ts`, `app/actions/dm.ts` |
| Загрузка в чужую папку | политики `storage.objects` | 0009 |
| Подделка «изменилось» в Realtime | клиентские события — в других каналах | 0033 |
| Чужая личка в Realtime | `dm:<a>:<b>` — только эти двое и без блокировки | 0033 |
| Мусор в аргументах server actions | `lib/validate.ts` | все `app/actions/*` |
| Подделка вебхука | HMAC-SHA256, окно 5 минут, лимит тела | `app/api/webhooks/stripe` |
| Открытый редирект после входа | `safeNext()` на сервере, на странице входа и в ссылках из писем | `lib/safe-next.ts` |
| Смена пароля с чужой открытой сессии | по ссылке из письма — httpOnly-метка на 15 минут, привязанная к аккаунту; изнутри — только с текущим паролем | `lib/recovery.ts`, `app/auth/reset`, `/settings/security` |
| «Есть ли такой аккаунт?» | один ответ на вход, регистрацию, сброс и повторное письмо — в том числе на повтор в ту же минуту; ник не из почты | `app/auth/actions.ts`, 0043, `docs/AUTH.md` |
| Токен после выхода или смены пароля | база признаёт только живую сессию из `auth.sessions` | `private.current_user_id()`, 0043 |
| Аккаунт без профиля (петля редиректов) | профиль не удалить в обход аккаунта; восстановление `ensure_my_profile()` | 0043, `lib/data/session.ts` |
| Регистрация в обход формы | кому можно — решает триггер на `auth.users` (`private.signup_allowed`) | 0043, 0044 |
| Пароль короче правил через API Auth | минимальная длина в самом Auth | `supabase/config.toml`, панель |
| Подбор пароля из украденной сессии | 5 проверок пароля за 15 минут на аккаунт | `claim_reauth_attempt()`, 0043 |
| Один перебор блокирует вход всем (лимит Auth по IP сервера) | пересылка IP человека `Sb-Forwarded-For` | `lib/supabase/auth.ts`, «Сделать руками» |
| Сессия по http | cookie сессии `Secure` в продакшене | `lib/supabase/cookie-options.ts` |
| Почта в адресе, журналах и Referer | почта между формой и «Проверь почту» — в httpOnly-cookie | `lib/auth/pending-email.ts` |
| Пароли и токены в журнале | в строке журнала только категория, код Auth и id запроса | `lib/auth/log.ts` |
| Потеря сессии после ссылки из письма за прокси | редирект относительным путём — на тот же хост | `lib/relative-redirect.ts` |
| Подмена Host в ссылках из писем | адрес из настроек | `lib/site-url.ts` |
| XSS | CSP с nonce на каждый запрос, без `unsafe-inline` для скриптов | `lib/csp.ts`, `middleware.ts`, `app/layout.tsx` |
| Кликджекинг | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | `next.config.ts` |
| Утечка данных при поиске | поиск людей на сервере, не больше 30 совпадений | 0036 |
| Хранение лишнего | сроки хранения ночным cron | 0034 |

## Как это проверено

- **149 тестов прав в базе** (`supabase/tests/database`) от имени настоящих
  пользователей: роль `authenticated` и JWT с живой сессией, как запрос из
  приложения. В CI на чистой Supabase после наката всех миграций с нуля.
- **E2E мимо приложения** (`e2e-live/security.spec.ts`): настоящим токеном
  вошедшего — в `/rest/v1` за чужой идеей, чужим профилем, «Личность
  подтверждена» и вузом себе; старый токен после выхода на всех устройствах.
- **Советник Supabase (security):** 0 замечаний. Было 25, одно уровня ERROR.
- **`supabase db lint`:** без ошибок.
- **CodeQL** (security-extended) на каждый push.
- **E2E** проверяет, что CSP не блокирует ни одного своего скрипта.
- **Вручную** — блокировка, жалобы, ограничение частоты, удаление аккаунта
  проверены в браузере на живой базе, «печатает» и «Прочитано» — двумя
  браузерами одновременно.

## Зависимости

`npm audit --omit=dev`: 0 уязвимостей в том, что уходит в сборку (CI
проверяет на каждый коммит). В инструментах разработки остаются 5
уязвимостей высокого уровня в одной цепочке `eslint-config-next →
@next/eslint-plugin-next → fast-glob → micromatch → braces`: отказ в
обслуживании на вложенных шаблонах путей. Работает только когда линтер
разбирает наши же файлы, к пользователям не попадает; исправленной версии
нет. Dependabot (`.github/dependabot.yml`) предложит обновление, как
только оно выйдет.

## Сделать руками

Подробно о входе — `docs/AUTH.md`. Для продакшена обязательно:

- **Supabase → Authentication → Rate Limits → IP Address Forwarding** —
  включить, и в Vercel задать `SUPABASE_SECRET_KEY` (новый ключ
  `sb_secret_…`) и `SUPABASE_AUTH_IP_FORWARDING=true`. Без этого лимиты
  входа и регистрации Auth общие на всех пользователей.
- **Supabase → Authentication → Providers → Email → Minimum password
  length: 8** — как в форме и в `supabase/config.toml`.
- **Supabase → Authentication → Email Templates → Confirm signup**: ссылку
  заменить на
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` —
  подтверждение почты на любом устройстве.
- **CAPTCHA** (Authentication → Attack Protection, Turnstile или hCaptcha) —
  рекомендовано: закрывает перебор и перечисление аккаунтов на уровне
  самого Auth. Требует виджета в формах и правки CSP.

- **Supabase → Authentication → Providers → Email → Prevent use of leaked
  passwords** (платный тариф).
- **Supabase → Authentication → URL Configuration**: Site URL —
  `https://to-get-there-mu.vercel.app`; Redirect URLs —
  `https://to-get-there-mu.vercel.app/**` и `http://localhost:3000/**`
  (сброс пароля возвращает на `/auth/callback?type=recovery`).
- **Supabase → Authentication → Email Templates → Reset Password**: ссылку
  `{{ .ConfirmationURL }}` заменить на
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
  Со стандартной ссылкой (PKCE) сброс работает только в том браузере, где
  его запросили; с этой — и когда письмо открывают на телефоне. Оба пути
  проверяет `e2e-live/reset.spec.ts`.
- **Supabase → Authentication → SMTP**: свой провайдер почты. Встроенный
  отправляет письма только адресам участников команды проекта — студенты
  не получат письмо подтверждения.
- **Supabase → Storage → verification**: пустой бакет без политик, остался
  от 0009 — можно удалить кнопкой.
- **GitHub → Settings → Branches**: защитить `main` — merge только через PR
  с зелёными проверками `check`, `audit`, `e2e`, `database`, `CodeQL`.
- **Vercel → Environment Variables**: `SUPABASE_SECRET_KEY`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (только для проверки
  личности, без префикса `NEXT_PUBLIC_`); `LEGAL_OPERATOR_*` для Impressum.

## Сообщить об уязвимости

Не в публичные issues. GitHub → Security → Report a vulnerability, или
почтой из Impressum. Ответ — в течение 72 часов.
