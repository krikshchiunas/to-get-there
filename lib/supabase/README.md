# lib/supabase

Два клиента и ничего больше. Логика запросов здесь не живёт: она появится в
`lib/data/*.ts` на пятом этапе, с теми же сигнатурами, что у функций в
`lib/mock/index.ts` (см. `docs/ROADMAP.md`).

| Файл | Где использовать |
| --- | --- |
| `client.ts` | клиентские компоненты (`"use client"`) |
| `server.ts` | серверные компоненты, серверные действия, route handlers |

```ts
// серверный компонент
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from("post_cards").select("*").eq("in_feed", true).order("date_start");
}
```

```ts
// клиентский компонент
"use client";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
```

## Правила

**Один клиент на запрос.** `server.ts` читает `cookies()`, а он
привязан к запросу. Нельзя сохранять результат `createClient()` в
переменную модуля — иначе чужая сессия достанется следующему посетителю.
В Next.js 15 `cookies()` асинхронный, поэтому серверная фабрика тоже
асинхронная и её всегда `await`.

**`setAll` в try/catch — это не глушение ошибки.** Серверный компонент не
имеет права писать cookie. Обновление сессии — работа `middleware.ts`
(появится на шестом этапе), а чтение просто пользуется тем токеном, который
уже есть.

**Переменные окружения читаются статически.** Next.js подставляет
`NEXT_PUBLIC_*` только при буквальном обращении к свойству, не через
вычисляемый ключ — поэтому `process.env.NEXT_PUBLIC_SUPABASE_URL`, а не
`process.env[name]`. Образец значений — `.env.local.example`.

**Сервисный ключ сюда не попадает.** `SUPABASE_SERVICE_ROLE_KEY` обходит RLS
целиком; он нужен только скриптам и инструментам модерации (выставить
`is_verified`), и живёт в их собственном клиенте, а не в этих двух файлах.

## Типы

Клиенты нетипизированные: `lib/database.types.ts` ещё не существует.
Сгенерировать и подключить:

```bash
npm run db:types     # supabase gen types typescript --local > lib/database.types.ts
```

```ts
import type { Database } from "@/lib/database.types";

createBrowserClient<Database>(url, anonKey);
createServerClient<Database>(url, anonKey, { cookies: cookieMethods });
```

До этого контракт — строковые типы из `lib/types.ts`: они повторяют схему
колонка в колонку, в том же регистре и с той же нулевой допустимостью.

## Что увидит клиент

Без сессии — только справочники вузов и категорий (они нужны регистрации).
С сессией — ровно то, что разрешают политики RLS для этого человека
(`docs/DATABASE.md`, раздел про политики). Удобнее всего начинать с двух
представлений — `post_cards` для ленты и карточек и `active_posts` для «что
сейчас в ленте».
