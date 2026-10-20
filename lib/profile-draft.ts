/**
 * Черновик профиля: что человек правит на «Настройки → Профиль» и как это
 * проверяется до отправки. Без React — чтобы правила покрывались тестами
 * (lib/profile-draft.test.ts), а форма только показывала результат.
 */

import type { UserView } from "@/lib/types";

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 24;
export const FACULTY_MAX = 60;
export const BIO_MAX = 280;
/** Интересов и целей на экране — не больше 10 по 24 символа (база держит 20 по 40). */
export const LIST_MAX = 10;
export const ITEM_MAX = 24;

// То же правило, что CHECK users_nickname_fmt в 0003: ник — часть адреса /u/<ник>.
const NICKNAME_ALLOWED = /^[a-z0-9][a-z0-9._]*$/;

export type ProfileField = "nickname" | "faculty" | "bio";
export type ProfileErrors = Partial<Record<ProfileField, string>>;

/** Порядок полей на экране: фокус уходит на первое с ошибкой. */
export const PROFILE_FIELD_ORDER: readonly ProfileField[] = ["nickname", "faculty", "bio"];

export interface ProfileDraft {
  nickname: string;
  faculty: string;
  bio: string;
  interests: string[];
  goals: string[];
}

export function draftOf(user: UserView): ProfileDraft {
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

export function sameDraft(a: ProfileDraft, b: ProfileDraft): boolean {
  return (
    a.nickname === b.nickname &&
    a.faculty === b.faculty &&
    a.bio === b.bio &&
    sameList(a.interests, b.interests) &&
    sameList(a.goals, b.goals)
  );
}

/**
 * Проверка перед «Сохранить». Ошибки — словами, которые говорят, как
 * исправить; `clean` — то, что уйдёт на сервер, если ошибок нет.
 */
export function checkProfile(draft: ProfileDraft): { errors: ProfileErrors; clean: ProfileDraft } {
  const errors: ProfileErrors = {};
  const nickname = draft.nickname.trim().toLowerCase();
  const faculty = draft.faculty.trim();
  const bio = draft.bio.trim();

  if (!nickname) {
    errors.nickname = "Ник нужен: по нему тебя находят в поиске и узнают в чатах.";
  } else if (nickname.length < NICKNAME_MIN) {
    errors.nickname = `В нике минимум ${NICKNAME_MIN} символа. Добавь ещё.`;
  } else if (nickname.length > NICKNAME_MAX) {
    errors.nickname = `Ник длиннее ${NICKNAME_MAX} символов. Убери ${nickname.length - NICKNAME_MAX}.`;
  } else if (!NICKNAME_ALLOWED.test(nickname)) {
    errors.nickname =
      "В нике — латиница, цифры, точка и подчёркивание, начало — с буквы или цифры. Остальное убери.";
  }

  if (faculty.length > FACULTY_MAX) {
    errors.faculty = `Строка длиннее ${FACULTY_MAX} символов. Убери ${faculty.length - FACULTY_MAX}.`;
  }

  if (bio.length > BIO_MAX) {
    errors.bio = `Описание длиннее ${BIO_MAX} символов. Убери ${bio.length - BIO_MAX}.`;
  }

  return { errors, clean: { ...draft, nickname, faculty, bio } };
}

/**
 * Новая запись в список интересов или целей: либо готовая строка, либо
 * объяснение, почему её не добавить.
 */
export function tagToAdd(
  raw: string,
  items: readonly string[],
): { ok: true; value: string } | { ok: false; error: string } {
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean) return { ok: false, error: "Сначала впиши, что добавить." };
  if (clean.length > ITEM_MAX) return { ok: false, error: `В одной записи не больше ${ITEM_MAX} символов.` };
  if (items.some((item) => item.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, error: "Это уже в списке." };
  }
  if (items.length >= LIST_MAX)
    return { ok: false, error: `Больше ${LIST_MAX} не добавить. Удали что-нибудь.` };
  return { ok: true, value: clean };
}
