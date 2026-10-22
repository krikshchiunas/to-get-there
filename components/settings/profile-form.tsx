"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { updateProfile } from "@/app/actions/settings";
import { notify } from "@/components/ui/toast";
import { pluralRu } from "@/lib/format";
import {
  BIO_MAX,
  checkProfile,
  draftOf,
  FACULTY_MAX,
  NICKNAME_MAX,
  PROFILE_FIELD_ORDER,
  sameDraft,
  type ProfileDraft,
  type ProfileErrors,
  type ProfileField,
} from "@/lib/profile-draft";
import { Button } from "@/components/ui/button";
import { CharCount, Field, TextArea, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import type { UserView } from "@/lib/types";
import { AvatarPicker } from "./avatar-picker";
import { TagEditor } from "./tag-editor";

/**
 * Профиль.
 *
 * Правка живёт в локальном состоянии: кнопка «Сохранить» становится активной
 * только когда что-то действительно изменилось. Фото сохраняется отдельно,
 * сразу после загрузки (avatar-picker.tsx). Правила полей — в
 * lib/profile-draft.ts.
 *
 * Рамок на экране нет: поля — заливка, секции разделены заголовком и
 * воздухом, фото профиля лежит прямо на фоне, а не в карточке.
 */

const FIELD_IDS = {
  nickname: "profile-nickname",
  faculty: "profile-faculty",
  bio: "profile-bio",
  interests: "profile-interests",
  goals: "profile-goals",
} as const;

export function ProfileForm({ user }: { user: UserView }) {
  const [draft, setDraft] = useState<ProfileDraft>(() => draftOf(user));
  const [saved, setSaved] = useState<ProfileDraft>(() => draftOf(user));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [confirmed, setConfirmed] = useState(false);

  const dirty = !sameDraft(draft, saved);

  function patch(change: Partial<ProfileDraft>) {
    setDraft((current) => ({ ...current, ...change }));
    setConfirmed(false);
  }

  function dismissError(key: ProfileField) {
    setErrors((previous) => {
      if (previous[key] === undefined) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  const [saving, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { errors: next, clean } = checkProfile(draft);
    setErrors(next);

    const firstProblem = PROFILE_FIELD_ORDER.find((key) => next[key] !== undefined);
    if (firstProblem !== undefined) {
      const element = document.getElementById(FIELD_IDS[firstProblem]);
      if (element) {
        element.focus({ preventScroll: true });
        element.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    startTransition(async () => {
      const result = await updateProfile({
        nickname: clean.nickname,
        faculty: clean.faculty,
        bio: clean.bio,
        interests: clean.interests,
        goals: clean.goals,
      });
      if (!result.ok) {
        notify(result.error);
        return;
      }
      setDraft(clean);
      setSaved(clean);
      setConfirmed(true);
    });
  }

  const problemCount = Object.keys(errors).length;

  return (
    <form noValidate onSubmit={handleSubmit} className="px-4 pt-5">
      <section className="flex items-start gap-4">
        <AvatarPicker user={{ ...user, nickname: draft.nickname.trim() || user.nickname }} />
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
              {user.university ? user.university.name : "Вуз не подтверждён"}
            </p>
            <p className="mt-1 text-[13px] leading-[1.4] text-ink-soft">
              Приходит из подтверждённой университетской почты, поэтому здесь не меняется. От него зависит
              лента «Университет».
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
                Сохранено. Так тебя теперь видят другие.
              </p>
            ) : null}

            <Button type="submit" size="lg" full disabled={!dirty || saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
