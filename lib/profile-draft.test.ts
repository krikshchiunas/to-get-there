import { describe, expect, it } from "vitest";
import { users } from "@/lib/mock/users";
import {
  BIO_MAX,
  checkProfile,
  draftOf,
  FACULTY_MAX,
  ITEM_MAX,
  LIST_MAX,
  NICKNAME_MAX,
  sameDraft,
  tagToAdd,
  type ProfileDraft,
} from "./profile-draft";

const base: ProfileDraft = {
  nickname: "mara_t",
  faculty: "Информатика",
  bio: "Привет",
  interests: ["Боулдеринг"],
  goals: [],
};

describe("draftOf / sameDraft", () => {
  it("черновик — копия профиля, а не ссылка на его массивы", () => {
    const user = users[0];
    const draft = draftOf(user);
    expect(draft.nickname).toBe(user.nickname);
    expect(draft.interests).toEqual(user.interests);
    expect(draft.interests).not.toBe(user.interests);
  });

  it("пустые факультет и описание — пустые строки", () => {
    const draft = draftOf({ ...users[0], faculty: null, bio: null });
    expect(draft.faculty).toBe("");
    expect(draft.bio).toBe("");
  });

  it("сравнивает поля и списки по значению и порядку", () => {
    expect(sameDraft(base, { ...base, interests: ["Боулдеринг"] })).toBe(true);
    expect(sameDraft(base, { ...base, bio: "Пока" })).toBe(false);
    expect(sameDraft(base, { ...base, interests: [] })).toBe(false);
    expect(sameDraft(base, { ...base, goals: ["Сдать экзамен"] })).toBe(false);
    expect(
      sameDraft({ ...base, interests: ["a", "b"] }, { ...base, interests: ["b", "a"] }),
      "порядок важен — его видно на профиле",
    ).toBe(false);
  });
});

describe("checkProfile", () => {
  it("годный профиль: ник в нижнем регистре, края обрезаны", () => {
    const { errors, clean } = checkProfile({
      ...base,
      nickname: "  Mara_T ",
      faculty: " Информатика ",
      bio: " Привет ",
    });
    expect(errors).toEqual({});
    expect(clean).toMatchObject({ nickname: "mara_t", faculty: "Информатика", bio: "Привет" });
  });

  it("ник: пустой, короткий, длинный, с недопустимыми символами", () => {
    expect(checkProfile({ ...base, nickname: "  " }).errors.nickname).toMatch(/Ник нужен/);
    expect(checkProfile({ ...base, nickname: "ab" }).errors.nickname).toMatch(/минимум 3/);
    expect(checkProfile({ ...base, nickname: "a".repeat(NICKNAME_MAX + 2) }).errors.nickname).toMatch(
      /Убери 2/,
    );
    expect(checkProfile({ ...base, nickname: "_mara" }).errors.nickname).toMatch(/латиница/);
    expect(checkProfile({ ...base, nickname: "мара" }).errors.nickname).toMatch(/латиница/);
  });

  it("факультет и описание — по длине", () => {
    expect(checkProfile({ ...base, faculty: "ф".repeat(FACULTY_MAX + 1) }).errors.faculty).toMatch(/Убери 1/);
    expect(checkProfile({ ...base, bio: "о".repeat(BIO_MAX + 3) }).errors.bio).toMatch(/Убери 3/);
  });
});

describe("tagToAdd", () => {
  it("лишние пробелы схлопываются", () => {
    expect(tagToAdd("  Настольные   игры ", [])).toEqual({ ok: true, value: "Настольные игры" });
  });

  it("пустое, слишком длинное, повтор без учёта регистра", () => {
    expect(tagToAdd("   ", [])).toMatchObject({ ok: false, error: expect.stringMatching(/впиши/) });
    expect(tagToAdd("x".repeat(ITEM_MAX + 1), [])).toMatchObject({ ok: false });
    expect(tagToAdd("боулдеринг", ["Боулдеринг"])).toEqual({ ok: false, error: "Это уже в списке." });
  });

  it("полный список больше не принимает", () => {
    const full = Array.from({ length: LIST_MAX }, (_, index) => `тег ${index}`);
    expect(tagToAdd("новый", full)).toMatchObject({ ok: false, error: expect.stringMatching(/Удали/) });
  });
});
