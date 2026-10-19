"use client";

import { pluralRu } from "@/lib/format";
import { useState } from "react";
import type { FormEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CharCount, Field, TextArea, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import type { UserView } from "@/lib/types";

/**
 * Профиль.
 *
 * Правка живёт в локальном состоянии: кнопка «Сохранить» становится активной
 * только когда что-то действительно изменилось, и после сохранения честно
 * говорит, что дальше браузера это не ушло.
 *
 * Рамок на экране нет: поля — заливка, секции разделены заголовком и
 * воздухом, фото профиля лежит прямо на фоне, а не в карточке.
 */

const NICKNAME_MIN = 3;
const NICKNAME_MAX = 24;
const FACULTY_MAX = 60;
const BIO_MAX = 280;
const LIST_MAX = 10;
const ITEM_MAX = 24;

const NICKNAME_ALLOWED = /^[\p{L}\p{N}._-]+$/u;

const FIELD_IDS = {
  nickname: "profile-nickname",
  faculty: "profile-faculty",
  bio: "profile-bio",
  interests: "profile-interests",
  goals: "profile-goals",
} as const;

type FieldKey = "nickname" | "faculty" | "bio";

type Errors = Partial<Record<FieldKey, string>>;

interface Draft {
  nickname: string;
  faculty: string;
  bio: string;
  interests: string[];
  goals: string[];
}

function draftOf(user: UserView): Draft {
  return {
    nickname: user.nickname,
    faculty: user.faculty ?? "",
    bio: user.bio ?? "",
    interests: [...user.interests],
    goals: [...user.goals],
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.nickname === b.nickname &&
    a.faculty === b.faculty &&
    a.bio === b.bio &&
    sameList(a.interests, b.interests) &&
    sameList(a.goals, b.goals)
  );
}

export function ProfileForm({ user }: { user: UserView }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(user));
  const [saved, setSaved] = useState<Draft>(() => draftOf(user));
  const [errors, setErrors] = useState<Errors>({});
  const [confirmed, setConfirmed] = useState(false);

  const dirty = !sameDraft(draft, saved);

  function patch(change: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...change }));
    setConfirmed(false);
  }

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

    const next: Errors = {};
    const nickname = draft.nickname.trim();
    const faculty = draft.faculty.trim();
    const bio = draft.bio.trim();

    if (!nickname) {
      next.nickname = "Ник нужен: по нему тебя находят в поиске и узнают в чатах.";
    } else if (nickname.length < NICKNAME_MIN) {
      next.nickname = `В нике минимум ${NICKNAME_MIN} символа. Добавь ещё.`;
    } else if (nickname.length > NICKNAME_MAX) {
      next.nickname = `Ник длиннее ${NICKNAME_MAX} символов. Убери ${nickname.length - NICKNAME_MAX}.`;
    } else if (!NICKNAME_ALLOWED.test(nickname)) {
      next.nickname = "В нике можно буквы, цифры, точку, дефис и подчёркивание. Остальное убери.";
    }

    if (faculty.length > FACULTY_MAX) {
      next.faculty = `Строка длиннее ${FACULTY_MAX} символов. Убери ${faculty.length - FACULTY_MAX}.`;
    }

    if (bio.length > BIO_MAX) {
      next.bio = `Описание длиннее ${BIO_MAX} символов. Убери ${bio.length - BIO_MAX}.`;
    }

    setErrors(next);

    const firstProblem = (["nickname", "faculty", "bio"] as const).find(
      (key) => next[key] !== undefined,
    );
    if (firstProblem !== undefined) {
      const element = document.getElementById(FIELD_IDS[firstProblem]);
      if (element) {
        element.focus({ preventScroll: true });
        element.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    const clean: Draft = { ...draft, nickname, faculty, bio };

    // TODO(supabase): update users set nickname, faculty, bio, interests, goals where id = auth.uid()
    setDraft(clean);
    setSaved(clean);
    setConfirmed(true);
  }

  const problemCount = Object.keys(errors).length;

  return (
    <form noValidate onSubmit={handleSubmit} className="px-4 pt-5">
      <section className="flex items-start gap-4">
        <Avatar
          user={{ ...user, nickname: draft.nickname.trim() || user.nickname }}
          size="lg"
          withBadge
        />

        <div className="min-w-0">
          <p className="text-[15px]">Фото профиля</p>
          <p className="mt-1 text-[14px] leading-[1.4] text-ink-soft">
            Пока профиль показывает инициалы ника. Загрузка появится вместе с Supabase Storage —
            до него файл просто некуда положить.
          </p>
          <Button type="button" variant="quiet" size="sm" className="mt-3" disabled>
            <Icon name="image" size={15} />
            Загрузить фото
          </Button>
        </div>
      </section>

      <section className="mt-8 space-y-5">
        <h2 className="text-[13px] font-medium text-ink-faint">Кто ты</h2>

        <Field label="Ник" required htmlFor={FIELD_IDS.nickname} error={errors.nickname}>
          <TextInput
            id={FIELD_IDS.nickname}
            value={draft.nickname}
            maxLength={NICKNAME_MAX + 10}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.nickname ? true : undefined}
            onChange={(event) => {
              patch({ nickname: event.target.value });
              dismissError("nickname");
            }}
          />
        </Field>

        <Field
          label="Факультет"
          htmlFor={FIELD_IDS.faculty}
          hint="Свободная строка — напиши так, как говоришь сам."
          error={errors.faculty}
        >
          <TextInput
            id={FIELD_IDS.faculty}
            value={draft.faculty}
            placeholder="Информатика, 3-й семестр"
            maxLength={FACULTY_MAX + 10}
            autoComplete="off"
            aria-invalid={errors.faculty ? true : undefined}
            onChange={(event) => {
              patch({ faculty: event.target.value });
              dismissError("faculty");
            }}
          />
        </Field>

        <Field
          label="Описание"
          htmlFor={FIELD_IDS.bio}
          hint="Пара строк о том, зачем ты здесь. Это первое, что читают на твоём профиле."
          error={errors.bio}
        >
          <TextArea
            id={FIELD_IDS.bio}
            rows={4}
            value={draft.bio}
            placeholder="Недавно в Берлине. Ищу компанию для скалодрома и учебную группу по анализу."
            aria-invalid={errors.bio ? true : undefined}
            onChange={(event) => {
              patch({ bio: event.target.value });
              dismissError("bio");
            }}
          />
          <CharCount value={draft.bio} max={BIO_MAX} />
        </Field>

        <Field label="Университет" required>
          <div className="rounded-field bg-sunken px-3.5 py-3">
            <p className="flex items-center gap-2 text-[15px]">
              <Icon name="shield" size={16} className="shrink-0 text-ink-soft" />
              {user.university.name}
            </p>
            <p className="mt-1 text-[13px] leading-[1.4] text-ink-soft">
              Приходит из подтверждённой университетской почты, поэтому здесь не меняется. От него
              зависит лента «Университет».
            </p>
          </div>
        </Field>
      </section>

      <section className="mt-8 space-y-5">
        <h2 className="text-[13px] font-medium text-ink-faint">Интересы и цели</h2>

        <TagEditor
          id={FIELD_IDS.interests}
          label="Интересы"
          hint="По чему тебя найдут в поиске людей. Не больше 10."
          placeholder="Боулдеринг"
          emptyNote="Пока ни одного интереса."
          items={draft.interests}
          onChange={(interests) => patch({ interests })}
        />

        <TagEditor
          id={FIELD_IDS.goals}
          label="Цели"
          hint="Зачем ты в приложении — так понятнее, с чем к тебе приходить. Не больше 10."
          placeholder="Найти учебную группу"
          emptyNote="Пока ни одной цели."
          items={draft.goals}
          onChange={(goals) => patch({ goals })}
        />

        <p className="text-[14px] leading-[1.4] text-ink-soft">
          Кто видит интересы и цели, решают настройки приватности.
        </p>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-24 mt-8 border-t border-line bg-paper/95 px-4 backdrop-blur-sm md:-mb-10">
        <div className="u-safe-b pt-3">
          <div className="pb-[4.25rem] md:pb-3">
            {problemCount > 0 ? (
              <p role="alert" className="pb-2 text-center text-[12px] text-heat">
                {`${problemCount} ${pluralRu(problemCount, ["поле", "поля", "полей"])} нужно поправить.`}
              </p>
            ) : null}

            {confirmed && !dirty ? (
              <p role="status" className="pb-2 text-center text-[12px] text-ink-soft">
                Сохранено. Пока без базы данных изменения живут только в этом браузере.
              </p>
            ) : null}

            <Button type="submit" size="lg" full disabled={!dirty}>
              Сохранить
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * Список-массив: чипы с удалением и поле, которое добавляет по Enter или по
 * кнопке. Весь чип — одна кнопка, поэтому цель нажатия остаётся крупной.
 */
function TagEditor({
  id,
  label,
  hint,
  placeholder,
  emptyNote,
  items,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  emptyNote: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const full = items.length >= LIST_MAX;

  function add() {
    const clean = value.trim().replace(/\s+/g, " ");

    if (!clean) {
      setError("Сначала впиши, что добавить.");
      return;
    }
    if (clean.length > ITEM_MAX) {
      setError(`В одной записи не больше ${ITEM_MAX} символов.`);
      return;
    }
    if (items.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      setError("Это уже в списке.");
      return;
    }
    if (full) {
      setError(`Больше ${LIST_MAX} не добавить. Удали что-нибудь.`);
      return;
    }

    onChange([...items, clean]);
    setValue("");
    setError(null);
  }

  function remove(item: string) {
    onChange(items.filter((entry) => entry !== item));
    setError(null);
  }

  return (
    <Field label={label} hint={hint} htmlFor={id} error={error ?? undefined}>
      {items.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-x-2">
          {items.map((item) => (
            <li key={item}>
              {/* Чип — плашка, но цель нажатия остаётся высотой в строку. */}
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Удалить «${item}»`}
                className="flex h-10 items-center rounded-pill"
              >
                <Pill>
                  {item}
                  <Icon name="close" size={13} className="text-ink-faint" />
                </Pill>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pb-1 text-[14px] text-ink-faint">{emptyNote}</p>
      )}

      <div className="flex gap-2">
        <TextInput
          id={id}
          value={value}
          placeholder={placeholder}
          maxLength={ITEM_MAX}
          autoComplete="off"
          disabled={full}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
        />
        <Button type="button" variant="quiet" onClick={add} disabled={full} className="shrink-0">
          Добавить
        </Button>
      </div>

      <p className="u-tnum text-right text-[12px] text-ink-faint">
        {items.length}/{LIST_MAX}
        {full ? " — удали что-нибудь, чтобы добавить новое" : ""}
      </p>
    </Field>
  );
}
