# Как вносить изменения

## Запуск

Нужен Node 20+ (проверено на 24).

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

С `NEXT_PUBLIC_USE_MOCKS=true` всё работает без базы. Для работы с базой —
локальная Supabase (`supabase start`) или проект в облаке.

## Перед коммитом

```bash
npm run format
npm run lint
npm run typecheck
npm test
```

Если менялся интерфейс:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Если менялась схема или права (нужен Docker):

```bash
supabase start
supabase test db
```

CI повторяет всё это на каждый push и pull request, плюс аудит
зависимостей и CodeQL.

## Правила

- **Миграции только вперёд.** Новый файл `supabase/migrations/NNNN_что.sql`,
  старые не правятся. У новой таблицы — RLS, политики и тест в
  `supabase/tests/database`.
- **Права — в базе.** Проверка в server action без политики в базе не
  считается защитой.
- **Ввод server action проверяется** (`lib/validate.ts`) — его можно
  вызвать с любыми аргументами.
- **Интерфейс по контракту** — `docs/ui-contract.md`: глоссарий терминов,
  семь правил дизайна, доступность. Текст — по-русски и на «ты».
- **Без новых зависимостей в рантайме** без причины, записанной в PR.
- **Комментарии объясняют «почему»**, а не «что».

## Коммиты

Сообщение по-русски: первая строка — что изменилось для человека, дальше —
зачем и как проверено.
