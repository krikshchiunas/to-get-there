"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { CharCount, Field, RadioRow, TextArea, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import {
  eventTimeTone,
  listBody,
  listMeta,
  listTime,
  listTitle,
  verifiedSize,
} from "@/components/ui/list-row";
import { Pill } from "@/components/ui/pill";
import { Seats } from "@/components/ui/seats";
import { Verified } from "@/components/ui/verified";
import {
  DAY_MS,
  HOUR_MS,
  formatDayLabel,
  formatTime,
  pluralRu,
  toDatetimeLocal,
  urgencyOf,
} from "@/lib/format";
import { currentUser, getCategory } from "@/lib/mock";
import type { Category, ChatAccess } from "@/lib/types";
import { CATEGORY_GROUP_ID, CategoryPicker } from "./category-picker";
import {
  GeoPicker,
  describeGeo,
  geoError,
  geoFocusId,
  initialGeo,
  type GeoDraft,
} from "./geo-picker";

const TITLE_MAX = 70;
const DESCRIPTION_MAX = 600;
const SEATS_MIN = 2;
const SEATS_MAX = 100;

const FIELD_IDS = {
  title: "create-title",
  description: "create-description",
  startsAt: "create-starts-at",
  maxParticipants: "create-max-participants",
} as const;

type FieldKey = keyof typeof FIELD_IDS | "category" | "geo";

/** Validation order, which is also the order focus jumps in. */
const FIELD_ORDER: readonly FieldKey[] = [
  "title",
  "description",
  "category",
  "startsAt",
  "geo",
  "maxParticipants",
];

type Errors = Partial<Record<FieldKey, string>>;

/** What the form hands over once everything checks out. */
interface CreatedIdea {
  /** The clock at the moment of creation — the summary is formatted against it. */
  at: Date;
  title: string;
  description: string;
  category: Category;
  starts_at: Date;
  place: string;
  max_participants: number | null;
  chat_access: ChatAccess;
}

const accessLabels: Record<ChatAccess, string> = {
  everyone: "Все",
  followers: "Только подписчики",
  friends: "Только друзья",
};

const accessSummaries: Record<ChatAccess, string> = {
  everyone: "В чат может зайти любой",
  followers: "В чат могут зайти только твои подписчики",
  friends: "В чат могут зайти только твои друзья",
};

/** "символ" / "символа" / "символов" — for the over-the-limit errors. */
const charForms: [string, string, string] = ["символ", "символа", "символов"];

/** Tomorrow, rounded up to the next full hour. Hour-aligned on the epoch, so
 *  server and client agree no matter which zone the machine runs in. */
function nextFullHourTomorrow(now: Date): Date {
  const tomorrow = now.getTime() + DAY_MS;
  return new Date(Math.floor(tomorrow / HOUR_MS) * HOUR_MS + HOUR_MS);
}

function toChatAccess(raw: string): ChatAccess {
  if (raw === "followers") return "followers";
  if (raw === "friends") return "friends";
  return "everyone";
}

function focusTarget(key: FieldKey, geo: GeoDraft): string {
  if (key === "category") return CATEGORY_GROUP_ID;
  if (key === "geo") return geoFocusId(geo);
  return FIELD_IDS[key];
}

export function CreateForm({ now }: { now: Date }) {
  const defaultStart = toDatetimeLocal(nextFullHourTomorrow(now));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [geo, setGeo] = useState<GeoDraft>(initialGeo);
  const [maxParticipants, setMaxParticipants] = useState("");
  const [chatAccess, setChatAccess] = useState<ChatAccess>("everyone");
  const [errors, setErrors] = useState<Errors>({});
  const [created, setCreated] = useState<CreatedIdea | null>(null);

  function dismissError(key: FieldKey) {
    setErrors((previous) => {
      if (previous[key] === undefined) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategoryId(null);
    setStartsAt(defaultStart);
    setGeo(initialGeo);
    setMaxParticipants("");
    setChatAccess("everyone");
    setErrors({});
    setCreated(null);
    window.scrollTo({ top: 0 });
    window.requestAnimationFrame(() => {
      document.getElementById(FIELD_IDS.title)?.focus();
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const at = new Date();
    const next: Errors = {};

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      next.title = "Назови идею — например, «Пиво у канала после занятий».";
    } else if (cleanTitle.length > TITLE_MAX) {
      const over = cleanTitle.length - TITLE_MAX;
      next.title = `Название длиннее на ${over} ${pluralRu(over, charForms)}. Сократи его до ${TITLE_MAX}.`;
    }

    const cleanDescription = description.trim();
    if (!cleanDescription) {
      next.description = "Опиши, что будет, чтобы было понятно, на что человек идёт.";
    } else if (cleanDescription.length > DESCRIPTION_MAX) {
      const over = cleanDescription.length - DESCRIPTION_MAX;
      next.description = `Описание длиннее на ${over} ${pluralRu(over, charForms)}. Сократи его до ${DESCRIPTION_MAX}.`;
    }

    const category = categoryId === null ? undefined : getCategory(categoryId);
    if (!category) {
      next.category = "Выбери категорию, иначе идею не найдут.";
    }

    const departure = new Date(startsAt);
    if (!startsAt) {
      next.startsAt = "Укажи, когда начинаете.";
    } else if (Number.isNaN(departure.getTime())) {
      next.startsAt = "Дата или время заполнены не до конца. Укажи и то и другое.";
    } else if (departure.getTime() <= at.getTime()) {
      next.startsAt = "Это время уже прошло. Выбери время в будущем.";
    }

    const placeProblem = geoError(geo);
    if (placeProblem) next.geo = placeProblem;

    const cap = maxParticipants.trim();
    let seats: number | null = null;
    if (cap) {
      const parsed = Number(cap);
      if (!Number.isInteger(parsed) || parsed < SEATS_MIN || parsed > SEATS_MAX) {
        next.maxParticipants = `Введи целое число от ${SEATS_MIN} до ${SEATS_MAX} или оставь поле пустым — тогда без ограничений.`;
      } else {
        seats = parsed;
      }
    }

    setErrors(next);

    const firstProblem = FIELD_ORDER.find((key) => next[key] !== undefined);
    if (firstProblem !== undefined) {
      const element = document.getElementById(focusTarget(firstProblem, geo));
      if (element) {
        element.focus({ preventScroll: true });
        element.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    if (!category) return;

    // TODO(supabase): insert into posts, then router.push('/post/' + id)
    setCreated({
      at,
      title: cleanTitle,
      description: cleanDescription,
      category,
      starts_at: departure,
      place: describeGeo(geo),
      max_participants: seats,
      chat_access: chatAccess,
    });
    window.scrollTo({ top: 0 });
  }

  if (created) {
    return <CreatedPanel idea={created} onAgain={resetForm} />;
  }

  const problemCount = FIELD_ORDER.filter((key) => errors[key] !== undefined).length;

  return (
    <form noValidate onSubmit={handleSubmit} className="px-4 pt-5">
      <Group title="Идея" first>
        <Field label="Название" required htmlFor={FIELD_IDS.title} error={errors.title}>
          <TextInput
            id={FIELD_IDS.title}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              dismissError("title");
            }}
            placeholder="Пиво у канала после занятий"
            autoComplete="off"
            aria-invalid={errors.title ? true : undefined}
          />
          <CharCount value={title} max={TITLE_MAX} />
        </Field>

        <Field
          label="Описание"
          required
          htmlFor={FIELD_IDS.description}
          hint="Напиши, что будет и что стоит взять с собой или знать заранее."
          error={errors.description}
        >
          <TextArea
            id={FIELD_IDS.description}
            rows={5}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              dismissError("description");
            }}
            placeholder="Собираемся у моста, я беру ящик. Захвати плед — сидим на траве."
            aria-invalid={errors.description ? true : undefined}
          />
          <CharCount value={description} max={DESCRIPTION_MAX} />
        </Field>

        <Field
          label="Категория"
          required
          hint="Чтобы идею нашли в поиске и в ленте."
          error={errors.category}
        >
          <CategoryPicker
            value={categoryId}
            invalid={errors.category !== undefined}
            onChange={(id) => {
              setCategoryId(id);
              dismissError("category");
            }}
          />
        </Field>
      </Group>

      <Group title="Время и место">
        <Field
          label="Когда"
          required
          htmlFor={FIELD_IDS.startsAt}
          hint="Дата и время, когда всё реально начнётся."
          error={errors.startsAt}
        >
          <TextInput
            id={FIELD_IDS.startsAt}
            type="datetime-local"
            value={startsAt}
            min={toDatetimeLocal(now)}
            onChange={(event) => {
              setStartsAt(event.target.value);
              dismissError("startsAt");
            }}
            aria-invalid={errors.startsAt ? true : undefined}
          />
        </Field>

        <Field label="Где" required hint="Насколько точно указать место — решаешь ты.">
          <GeoPicker
            value={geo}
            error={errors.geo}
            onChange={(next) => {
              setGeo(next);
              dismissError("geo");
            }}
          />
        </Field>
      </Group>

      <Group title="Участники и доступ">
        <Field
          label="Максимум участников"
          htmlFor={FIELD_IDS.maxParticipants}
          hint="Оставь пустым — придут все, кто захочет."
          error={errors.maxParticipants}
        >
          <TextInput
            id={FIELD_IDS.maxParticipants}
            type="number"
            inputMode="numeric"
            min={SEATS_MIN}
            max={SEATS_MAX}
            step={1}
            value={maxParticipants}
            onChange={(event) => {
              setMaxParticipants(event.target.value);
              dismissError("maxParticipants");
            }}
            placeholder="без ограничений"
            className="u-tnum"
            aria-invalid={errors.maxParticipants ? true : undefined}
          />
        </Field>

        <Field
          label="Кто может зайти в чат"
          required
          hint="Идею видят все. Здесь ты решаешь, кто пишет в чате."
        >
          <div role="radiogroup" aria-label="Кто может зайти в чат" className="space-y-2">
            <RadioRow
              name="create-chat-access"
              value="everyone"
              checked={chatAccess === "everyone"}
              onChange={(raw) => setChatAccess(toChatAccess(raw))}
              label={accessLabels.everyone}
              description="Любой, кто увидит идею, может открыть чат."
              icon="chat"
            />
            <RadioRow
              name="create-chat-access"
              value="followers"
              checked={chatAccess === "followers"}
              onChange={(raw) => setChatAccess(toChatAccess(raw))}
              label={accessLabels.followers}
              description="Только те, кто на тебя подписан."
              icon="person"
            />
            <RadioRow
              name="create-chat-access"
              value="friends"
              checked={chatAccess === "friends"}
              onChange={(raw) => setChatAccess(toChatAccess(raw))}
              label={accessLabels.friends}
              description="Только те, на кого ты подписан и кто подписан на тебя."
              icon="lock"
            />
          </div>
        </Field>

        <Field label="Университет" required>
          <div className="rounded-field bg-sunken px-3.5 py-3">
            <p className="flex items-center gap-2 text-[15px]">
              <Icon name="shield" size={16} className="shrink-0 text-ink-soft" />
              {currentUser.university.name}
            </p>
            <p className="mt-1 text-[12px] text-ink-soft">
              Берётся из профиля, здесь не меняется. Идея попадёт в ленту «Университет» у{" "}
              {currentUser.university.short_name}.
            </p>
          </div>
        </Field>
      </Group>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-24 border-t border-line bg-paper/95 px-4 backdrop-blur-sm md:-mb-10">
        <div className="u-safe-b pt-3">
          <div className="pb-[4.25rem] md:pb-3">
            {problemCount > 0 ? (
              <p role="status" className="pb-2 text-center text-[12px] text-heat">
                {problemCount === 1
                  ? "Осталось заполнить или исправить одно поле."
                  : `Осталось заполнить или исправить ${problemCount} ${pluralRu(problemCount, ["поле", "поля", "полей"])}.`}
              </p>
            ) : null}
            <Button type="submit" size="lg" full>
              Создать идею
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/** A labelled block of fields, separated from the previous one by a hairline. */
function Group({
  title,
  children,
  first = false,
}: {
  title: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <section className={`space-y-6 ${first ? "" : "mt-8 border-t border-line pt-8"}`}>
      <h2 className="text-[13px] font-medium text-ink-faint">{title}</h2>
      {children}
    </section>
  );
}

/** Replaces the form once an idea is complete: the same idea, read back. */
function CreatedPanel({ idea, onAgain }: { idea: CreatedIdea; onAgain: () => void }) {
  const urgency = urgencyOf(idea.starts_at, idea.at);

  return (
    <section className="u-rise px-4 pt-6 pb-10">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-signal-wash text-signal">
          <Icon name="check" size={21} />
        </span>
        <h2 className="text-[20px] font-semibold">Идея создана</h2>
      </div>

      {/* Превью — ровно та же строка, что в ленте: аватар слева как якорь,
          «ник · вуз» и время в первой строке, название, две строки описания,
          одна строка метаданных. Геометрия берётся из `list-row`, чтобы она
          не разъехалась с лентой. Рамки, скругления и второго фона здесь нет:
          в ленте их тоже нет, а человек должен узнать свою идею. */}
      <p className="mt-6 text-[13px] font-medium text-ink-faint">Вот как она выглядит в ленте:</p>

      <article className="mt-1.5 flex gap-3">
        <Avatar user={currentUser} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="flex min-w-0 items-center gap-1 text-[15px] font-medium">
              <span className="truncate">{currentUser.nickname}</span>
              {currentUser.is_verified ? (
                <Verified size={verifiedSize} className="shrink-0" />
              ) : null}
            </span>

            <span aria-hidden className="text-[14px] text-ink-soft">
              ·
            </span>
            <span className="truncate text-[14px] text-ink-soft">
              {currentUser.university.short_name}
            </span>

            <time
              dateTime={idea.starts_at.toISOString()}
              className={`${listTime} ml-auto pl-2 ${eventTimeTone(urgency)}`}
            >
              <span className="sr-only">Начало в </span>
              {formatTime(idea.starts_at)}
            </time>
          </div>

          <h3 className={`mt-0.5 ${listTitle}`}>{idea.title}</h3>

          <p className={`u-clamp-2 mt-0.5 ${listBody}`}>{idea.description}</p>

          {/* Одна строка: день и места остаются целыми, длинный адрес ужимается. */}
          <p className={`mt-1.5 flex items-center gap-x-1.5 whitespace-nowrap ${listMeta}`}>
            <span className="u-tnum shrink-0">{formatDayLabel(idea.starts_at, idea.at)}</span>
            <span aria-hidden className="shrink-0">
              ·
            </span>
            <span className="min-w-0 truncate">{idea.place}</span>
            <span aria-hidden className="shrink-0">
              ·
            </span>
            <Seats count={1} max={idea.max_participants} className="shrink-0" />
          </p>
        </div>
      </article>

      {/* Категория и доступ в чат в строке ленты не показываются — они стоят
          под превью как то, что выбрал автор, а не как часть строки. */}
      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14px] text-ink-soft">
        <Pill icon={idea.category.icon}>{idea.category.name}</Pill>
        <span className="flex items-center gap-1.5">
          <Icon
            name={idea.chat_access === "everyone" ? "chat" : "lock"}
            size={14}
            className="shrink-0"
          />
          {accessSummaries[idea.chat_access]}
        </span>
      </p>

      <p className="mt-4 text-[13px] leading-[1.4] text-ink-soft">
        Пока идея живёт только в этом браузере. Когда подключим базу, она попадёт в ленту и
        откроется чат.
      </p>

      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
        <Button type="button" size="lg" full onClick={onAgain}>
          Создать ещё идею
        </Button>
        <ButtonLink href="/" variant="quiet" size="lg" full>
          К идеям
        </ButtonLink>
      </div>
    </section>
  );
}
