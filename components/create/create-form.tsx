"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost } from "@/app/actions/posts";
import { usePlace } from "@/lib/use-place";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CharCount, Field, RadioRow, TextArea, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import {
  DAY_MS,
  HOUR_MS,
  pluralRu,
  toDatetimeLocal,
  berlinLocalToIso,
} from "@/lib/format";

import type { Category, ChatAccess, UserView } from "@/lib/types";
import { CATEGORY_GROUP_ID, CategoryPicker } from "./category-picker";
import {
  GeoPicker,
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

const accessLabels: Record<ChatAccess, string> = {
  everyone: "Все",
  followers: "Только подписчики",
  friends: "Только друзья",
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

export function CreateForm({
  now,
  viewer,
  categories,
  cities,
}: {
  now: Date;
  /** Автор будущей идеи: университет берётся из его профиля и не правится. */
  viewer: UserView;
  categories: Category[];
  cities: string[];
}) {
  const getCategory = (id: string) => categories.find((category) => category.id === id);
  const router = useRouter();
  const { place, locate, resetToCampus, locating, error: locateError } = usePlace(viewer.university);
  const [submitting, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultStart = toDatetimeLocal(nextFullHourTomorrow(now));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [geo, setGeo] = useState<GeoDraft>(initialGeo);
  const [maxParticipants, setMaxParticipants] = useState("");
  const [chatAccess, setChatAccess] = useState<ChatAccess>("everyone");
  const [errors, setErrors] = useState<Errors>({});

  function dismissError(key: FieldKey) {
    setErrors((previous) => {
      if (previous[key] === undefined) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
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

    const startIso = berlinLocalToIso(startsAt);
    if (!startIso) {
      setErrors({ startsAt: "Дата или время заполнены не до конца. Укажи и то и другое." });
      return;
    }

    // Место. Радиус — точка отсчёта (кампус или геолокация); сервер огрубит
    // её до километра. Область — точка, выбранная на карте, и подсказка
    // словами. Город — только город. Город обязателен в любом режиме.
    const geoInput =
      geo.mode === "radius"
        ? {
            geoMode: "radius" as const,
            geoCity: viewer.university.city,
            geoAddress: place.source === "campus" ? `Рядом с кампусом ${viewer.university.short_name}` : null,
            geoLat: place.lat,
            geoLng: place.lng,
            geoRadiusM: geo.radius_m,
          }
        : geo.mode === "area"
          ? {
              geoMode: "area" as const,
              geoCity: viewer.university.city,
              geoAddress: geo.meeting_point.trim(),
              geoLat: geo.point?.lat ?? null,
              geoLng: geo.point?.lng ?? null,
              geoRadiusM: null,
            }
          : {
              geoMode: "city" as const,
              geoCity: geo.city.trim(),
              geoAddress: null,
              geoLat: null,
              geoLng: null,
              geoRadiusM: null,
            };

    setSubmitError(null);
    startTransition(async () => {
      const result = await createPost({
        title: cleanTitle,
        description: cleanDescription,
        categoryId: category.id,
        dateStart: startIso,
        maxParticipants: seats,
        chatAccess,
        ...geoInput,
      });

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      // Сразу в чат своей идеи: автор уже в нём, его посадил триггер.
      if (result.data) router.push(`/post/${result.data.id}`);
    });
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
            categories={categories}
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
            cities={cities}
            value={geo}
            error={errors.geo}
            place={place}
            onLocate={locate}
            onResetToCampus={resetToCampus}
            locating={locating}
            locateError={locateError}
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
              {viewer.university.name}
            </p>
            <p className="mt-1 text-[12px] text-ink-soft">
              Берётся из профиля, здесь не меняется. Идея попадёт в ленту «Университет» у{" "}
              {viewer.university.short_name}.
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
            {submitError ? (
              <p role="alert" className="mb-3 text-[14px] leading-[1.4] text-heat">
                {submitError}
              </p>
            ) : null}
            <Button type="submit" size="lg" full disabled={submitting}>
              {submitting ? "Публикуем…" : "Создать идею"}
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
