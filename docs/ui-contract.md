# UI contract

Shared rules for every screen. The foundation files below already exist and are
**not to be edited** by feature work — read them and build on them.

## Foundation (read before writing a screen)

| File | What it gives you |
| --- | --- |
| `lib/types.ts` | Every domain type. Row types mirror Postgres (snake_case); `*View` types are rows plus joins. |
| `lib/mock/index.ts` | The only data source during stages 1–3. Functions already have the signature their Supabase versions will have. |
| `lib/format.ts` | Русское форматирование дат и времени, правило ленты, места, расстояния, `pluralRu`. |
| `app/globals.css` | Design tokens. |
| `components/ui/*` | Shared primitives. |
| `components/nav/bottom-nav.tsx` | Primary navigation; already mounted in `app/layout.tsx`. |

## Язык дизайна

Измерено в живых лентах Threads (дизайн-язык Meta, то есть Instagram) и
Bluesky (линия Twitter) в октябре 2026. Выводы ниже — не вкусовщина, а то,
что эти продукты реально делают, и чего не делал первый вариант этого
приложения.

### Семь правил, от которых нельзя отступать

1. **Нет карточек.** Элемент ленты, списка чатов, результата поиска лежит
   прямо на фоне и отделён снизу линией `u-feed-divider` (1px, во всю ширину
   колонки). Ни `border` по кругу, ни `rounded-card`, ни второго фона под
   элементом. Контейнер в контейнере — это язык дашборда, а не ленты.
2. **Нет теней.** Ни одной. В Bluesky на всех элементах шире 300px ровно ноль
   `box-shadow`.
3. **Вес 400 почти везде.** `font-medium` (500) допустим только для ника
   автора, названия идеи, времени и активной вкладки. `font-semibold` — ровно
   в пяти местах: заголовок экрана в `PageHeader`, имя на собственной шапке
   профиля, логотип, заголовок пустого состояния и заголовок листа. Так же
   устроены Threads и Bluesky: имя профиля там набрано крупно и жирно, а в
   ленте полужирного нет вовсе. `font-bold` — нигде.
4. **Две роли цвета текста.** `text-ink` — содержание, `text-ink-soft` — всё
   служебное. `text-ink-faint` только для заголовков групп и совсем
   третьестепенного. Третий уровень внутри одной строки — запрещён.
5. **Рамку заменяет заливка.** Вторичная кнопка, поле ввода, чип, плашка —
   `bg-sunken` без `border`. Линия на экране весит больше, чем заливка.
6. **Цвета почти нет.** `signal` появляется только на: активной вкладке,
   кнопке создания, кнопке подписки, ссылке-действии. `heat` — только когда
   событие скоро (`urgencyOf` = `now`/`soon`) и на деструктивных действиях.
7. **Одна гарнитура.** Второго шрифта в приложении нет. `u-display` — это та
   же гарнитура с табличными цифрами, нужна только там, где цифры должны
   выстраиваться в колонку.

### Шкала

| Роль | Размер | Вес | Цвет |
| --- | --- | --- | --- |
| Название идеи | `text-[16px]` | 500 | `ink` |
| Ник автора | `text-[15px]` | 500 | `ink` |
| Текст, описание | `text-[15px]` | 400 | `ink-soft` |
| Время в строке | `text-[15px] u-tnum` | 500 | `ink`, при `soon`/`now` — `heat` |
| Метаданные | `text-[14px]` | 400 | `ink-soft` |
| Заголовок группы дня | `text-[13px]` | 500 | `ink-faint` |

Межстрочный — `leading-[1.4]` для текста. Аватар в ленте и списках — `size="md"` (40px).

### Строка ленты — эталон

Все списки в приложении (лента, поиск, идеи в профиле, список чатов)
повторяют эту структуру, меняя только содержимое метаданных:

```
Сегодня                                       ← заголовок группы
┌ px-4 py-3.5, снизу u-feed-divider ──────────────────────┐
│ [40px]  jonas_k ✓  TU Berlin           19:30            │
│         Пиво у канала после занятий                     │
│         После последней лекции идём на Ландверканал…    │
│         Kreuzberg · 3 места свободно      💬 5           │
└─────────────────────────────────────────────────────────┘
```

- аватар — якорь слева, содержимое течёт справа от него
- время — справа в первой строке, единственное исключение из «всё служебное серое»
- описание — две строки через `u-clamp-2`
- метаданные — **одна** строка, разделитель `·` (в этом домене это читаемая
  конвенция всех изученных лент, и она разрешена именно здесь)
- действие — иконка чата со счётчиком участников справа в строке метаданных,
  а не залитая кнопка: вся строка и так открывает идею

**Вложенные ссылки запрещены.** Строка кликабельна через растянутую ссылку:
контейнер `relative`, название — `<Link className="after:absolute after:inset-0">`,
ссылка на автора — `relative z-10` поверх неё.

## Язык интерфейса — русский

Интерфейс пишется по-русски. Обращение к пользователю — **на «ты»** (аудитория
18–26 лет). Английский и другие языки добавим позже отдельным проходом, поэтому
строки живут прямо в компонентах — без слоя i18n.

### Глоссарий (единые термины, отклоняться нельзя)

| Сущность | Термин |
| --- | --- |
| пост-идея | **идея** |
| вкладки ленты | **Подписки** / **Университет** |
| кнопка входа в чат идеи | **В чат** |
| создание | **Создать идею**, заголовок экрана **Новая идея** |
| вместимость | **свободно** · **мест нет** |
| роли | **автор**, **модератор**, **участник** |
| вступить | **Присоединиться** |
| исключить | **Удалить из чата** |
| закрыть набор | **Закрыть набор** |
| опрос | **голосование** |
| закрепление | **Закрепить** / **Открепить** |
| подписка | **Подписаться** / **Вы подписаны** / **Подписаться взаимно** |
| друзья | **друзья** — вы подписаны друг на друга |
| списки | **Подписчики** / **Подписки** |
| личное сообщение | **Написать** |
| верификация | **Личность подтверждена**, экран — **Верификация** |
| разделы | **Идеи**, **Поиск**, **Чаты**, **Уведомления**, **Настройки**, **Профиль** |
| доступ в чат | **Все** / **Только подписчики** / **Только друзья** |
| гео-режимы | **Радиус вокруг меня** / **Область на карте** / **Указать город** |
| поля формы | **Название**, **Описание**, **Когда**, **Где**, **Категория**, **Максимум участников** |
| полный список категорий | кнопка **Другое** |
| фильтры | **Дата**, **Время суток**, **Применить фильтры**, **Сбросить** |
| действия | **Сохранить**, **Назад**, **Закрыть**, **Отмена** |
| необязательное поле | **необязательно** |

### Правила копирайта

- Кнопка называет то, что произойдёт: «Создать идею», «В чат», «Сохранить».
  Название действия не меняется по ходу сценария.
- Никаких разряженных заглавных подписей, никаких строк вида `A · B · C`,
  никаких `→` в тексте кнопок и ссылок, никакой нумерации `01 / 02 / 03`
  там, где содержимое не является последовательностью.
- Пустой экран говорит, что делать дальше, и содержит само действие.
- Ошибка объясняет, что не так и как починить. Она не извиняется.
- Множественные числа — через `pluralRu` из `lib/format.ts`, а не «1 дней».

## Technical rules

- **Next.js 15 App Router.** `params` and `searchParams` are Promises:
  ```tsx
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
  }
  ```
- **Server components by default.** Add `"use client"` only for a component
  that needs state, effects or event handlers.
- **Reading the clock.** Any page whose output depends on the current time
  adds `export const dynamic = "force-dynamic";` and reads `const now = new
  Date()` once, then passes `now` down. Client components that show relative
  time use `<TimeFromNow>` instead.
- **No new dependencies.** No icon library, no date library, no UI kit. Icons
  come from `components/ui/icon.tsx`; add a key to `IconName` in
  `lib/types.ts` only if you genuinely need a new glyph.
- **No `any`, no non-null `!` on data you did not just create.** Handle the
  `undefined` from a mock lookup with `notFound()`.
- **Mutations are local.** There is no backend yet. A send, join, vote or
  toggle updates React state in the client component and nothing else. Mark
  each such handler with a `// TODO(supabase):` comment naming the call that
  will replace it.
- **Mobile-first.** Design at 375px, then let it breathe. Interactive targets
  are at least 40px tall. The single column is `max-w-[34rem]`, already
  applied by the layout.
- **Accessibility.** Every control has an accessible name, every input a
  `<label>`, focus is visible (the global `:focus-visible` handles it), icon
  buttons use `IconButton` with `label`.

## Routes

| Path | Owner | Notes |
| --- | --- | --- |
| `/` | feed | Tabs `?tab=following` and `?tab=university`. |
| `/create` | create | Form for a new idea. |
| `/post/[id]` | chat | The idea: detail, group chat, polls, participants, moderation. |
| `/u/[nickname]` | profile | Public profile. |
| `/messages` | dm | Chat list: idea chats and direct messages. |
| `/messages/[nickname]` | dm | One direct conversation. |
| `/search` | search | Search and filters. |
| `/notifications` | notifications | Notification list. |
| `/settings` | settings | Hub, plus `profile`, `privacy`, `notifications`, `verification`. |

Links between screens use exactly these paths. The profile's «Написать»
button goes to `/messages/<nickname>`; a feed card's chat button goes to
`/post/<id>`.

## Primitives

Геометрия строки списка живёт в одном файле — `components/ui/list-row.tsx`.
Любой список берёт классы оттуда и не изобретает свои отступы:

```tsx
import {
  listRow,       // контейнер: отступы, разделитель, подсветка наведения
  listLead,      // ведущий слот 40px: аватар или время
  listTime,      // время события, 15px/500
  listStamp,     // метка времени сообщения, 14px ink-soft
  listTitle, listBody, listMeta,
  groupHeading,  // заголовок группы
  verifiedSize,  // галочка рисуется один раз — рядом с ником, не на аватаре
  eventTimeTone, // два состояния: heat при soon/now, иначе ink
} from "@/components/ui/list-row";
```

```tsx
import { Icon } from "@/components/ui/icon";                    // name={IconName} size={20}
import { Avatar, AvatarLink, AvatarStack } from "@/components/ui/avatar";
import { Verified } from "@/components/ui/verified";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Pill, ChipLink, ChipButton } from "@/components/ui/pill";
import { Seats } from "@/components/ui/seats";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Sheet } from "@/components/ui/sheet";                  // client only
import { TimeFromNow } from "@/components/ui/time-from-now";    // client only
import {
  Field, TextInput, TextArea, Select, Switch, RadioRow, CharCount, SettingsGroup,
} from "@/components/ui/field";
```

`Button` variants: `primary | quiet | ghost | danger`, sizes `sm | md | lg`.

## Rules the product depends on

- A post leaves both feed tabs when the author closes sign-up (`is_closed`) or
  one hour after `date_start`. Use `isInFeed(post, now)` — never reimplement
  it. The chat stays reachable for everyone who was in it.
- Both feed tabs are strictly chronological: next departure first.
- Friends are a mutual follow. Use `isFriend(user)` from `lib/types.ts`.
- Chat access is `everyone | followers | friends` — check `canEnterChat(post)`
  and show `chatAccessReason(post)` when it is closed to the viewer.
- Profile and interest visibility: `canSeeProfile(user)`, `canSeeInterests(user)`.
- Direct messages: `canMessage(user)` reflects the recipient's setting.
- Roles in an idea chat are `author | moderator | participant | guest`.
  Moderator rights are per-person: `can_post_media`, `can_pin`, `can_poll`,
  `can_kick`. The author holds all of them and alone may appoint moderators,
  edit their rights and close sign-up.
