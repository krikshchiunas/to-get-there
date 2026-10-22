"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { createPost, updatePost } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";
import { CharCount, Field, TextArea, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { berlinLocalToIso, pluralRu, toDatetimeLocal } from "@/lib/format";
import {
  checkIdea,
  DESCRIPTION_MAX,
  geoFocusId,
  geoFromPost,
  geoInputOf,
  IDEA_FIELD_IDS as FIELD_IDS,
  IDEA_FIELD_ORDER as FIELD_ORDER,
  initialGeo,
  nextFullHourTomorrow,
  SEATS_MAX,
  SEATS_MIN,
  TITLE_MAX,
  type GeoDraft,
  type IdeaErrors,
  type IdeaField,
} from "@/lib/idea-draft";
import type { Category, ChatAccess, PostView, UserView } from "@/lib/types";
import { usePlace } from "@/lib/use-place";
import { CATEGORY_GROUP_ID, CategoryPicker } from "./category-picker";
import { ChatAccessPicker } from "./chat-access-picker";
import { GeoPicker } from "./geo-picker";

/**
 * «Новая идея» и правка идеи — одна форма. Поля и их проверка — в
 * lib/idea-draft.ts; здесь состояние, фокус на первой ошибке и отправка.
 */

function focusTarget(key: IdeaField, geo: GeoDraft): string {
  if (key === "category") return CATEGORY_GROUP_ID;
  if (key === "geo") return geoFocusId(geo);
  return FIELD_IDS[key];
}

export function CreateForm({
  now,
  viewer,
  categories,
  cities,
  editing,
}: {
  now: Date;
  /** Автор будущей идеи: университет берётся из его профиля и не правится. */
  viewer: UserView;
  categories: Category[];
  cities: string[];
  /** Правка существующей идеи: поля начинаются с её значений. */
  editing?: PostView;
}) {
  const router = useRouter();
  const { place, locate, resetToCampus, locating, error: locateError } = usePlace(viewer.university);
  const [submitting, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultStart = toDatetimeLocal(nextFullHourTomorrow(now));

  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null);
  const [startsAt, setStartsAt] = useState(editing ? toDatetimeLocal(editing.date_start) : defaultStart);
  // Без подтверждённого вуза нет кампуса, от которого считать радиус, —
  // начинаем с города.
  const [geo, setGeo] = useState<GeoDraft>(() =>
    editing ? geoFromPost(editing) : viewer.university ? initialGeo : { ...initialGeo, mode: "city" },
  );
  const [maxParticipants, setMaxParticipants] = useState(editing?.max_participants?.toString() ?? "");
  const [chatAccess, setChatAccess] = useState<ChatAccess>(editing?.chat_access ?? "everyone");
  const [errors, setErrors] = useState<IdeaErrors>({});

  function dismissError(key: IdeaField) {
    setErrors((previous) => {
      if (previous[key] === undefined) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { errors: next, clean } = checkIdea(
      { title, description, categoryId, startsAt, geo, maxParticipants },
      { now: new Date(), categoryIds: categories.map((category) => category.id) },
    );
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

    if (categoryId === null) return;

    const startIso = berlinLocalToIso(startsAt);
    if (!startIso) {
      setErrors({ startsAt: "Дата или время заполнены не до конца. Укажи и то и другое." });
      return;
    }

    const geoInput = geoInputOf(geo, place, viewer.university);

    setSubmitError(null);
    const input = {
      title: clean.title,
      description: clean.description,
      categoryId,
      dateStart: startIso,
      maxParticipants: clean.seats,
      chatAccess,
      ...geoInput,
    };

    startTransition(async () => {
      if (editing) {
        const result = await updatePost(editing.id, input);
        if (!result.ok) {
          setSubmitError(result.error);
          return;
        }
        router.push(`/post/${editing.id}`);
        return;
      }

      const result = await createPost(input);
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

        <Field label="Категория" required hint="Чтобы идею нашли в поиске и в ленте." error={errors.category}>
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
          <ChatAccessPicker value={chatAccess} onChange={setChatAccess} />
        </Field>

        <Field label="Университет" required>
          <div className="rounded-field bg-sunken px-3.5 py-3">
            <p className="flex items-center gap-2 text-[15px]">
              <Icon name="shield" size={16} className="shrink-0 text-ink-soft" />
              {viewer.university ? viewer.university.name : "Вуз не подтверждён"}
            </p>
            <p className="mt-1 text-[12px] text-ink-soft">
              {viewer.university ? (
                <>
                  Берётся из профиля, здесь не меняется. Идея попадёт в ленту «Университет» у{" "}
                  {viewer.university.short_name}.
                </>
              ) : (
                "Вуз подтверждает университетская почта. Идею увидят в поиске и твои подписчики."
              )}
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
            {editing && editing.participant_count > 1 ? (
              <p className="mb-3 text-[13px] leading-[1.4] text-ink-soft">
                Если изменишь время или место, участники получат уведомление.
              </p>
            ) : null}
            <Button type="submit" size="lg" full disabled={submitting}>
              {editing
                ? submitting
                  ? "Сохраняем…"
                  : "Сохранить"
                : submitting
                  ? "Публикуем…"
                  : "Создать идею"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/** A labelled block of fields, separated from the previous one by a hairline. */
function Group({ title, children, first = false }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <section className={`space-y-6 ${first ? "" : "mt-8 border-t border-line pt-8"}`}>
      <h2 className="text-[13px] font-medium text-ink-faint">{title}</h2>
      {children}
    </section>
  );
}
