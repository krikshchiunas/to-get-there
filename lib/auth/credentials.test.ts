import { describe, expect, it } from "vitest";
import {
  checkEmail,
  checkNewPassword,
  checkPassword,
  checkSignIn,
  checkSignUp,
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD,
  normalizeEmail,
} from "./credentials";

describe("normalizeEmail", () => {
  it("обрезает края и приводит к нижнему регистру", () => {
    expect(normalizeEmail("  Mara.T@TU-Berlin.DE ")).toBe("mara.t@tu-berlin.de");
  });

  it("не строка — пустая строка, а не исключение", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(42)).toBe("");
  });
});

describe("checkEmail", () => {
  it("годный адрес — любой домен, не только вузовский", () => {
    expect(checkEmail("max@gmail.com")).toBeNull();
    expect(checkEmail("lena@tu-berlin.de")).toBeNull();
    expect(checkEmail("a.b+tag@sub.example.org")).toBeNull();
  });

  it("пустой и недописанный — ошибка у поля почты", () => {
    expect(checkEmail("")).toEqual({ field: "email", message: "Введи адрес почты." });
    for (const bad of ["max", "max@", "@gmail.com", "max@gmail", "max @gmail.com", "max@gmail.c"]) {
      expect(checkEmail(bad)?.field, bad).toBe("email");
    }
  });

  it("длиннее 254 символов — ошибка", () => {
    expect(checkEmail(`${"a".repeat(250)}@x.de`)).not.toBeNull();
  });
});

describe("пароль", () => {
  it(`короче ${MIN_PASSWORD} — ошибка; ${MIN_PASSWORD} — можно`, () => {
    expect(checkPassword("1234567")?.field).toBe("password");
    expect(checkPassword("12345678")).toBeNull();
  });

  it("без правил «заглавная и цифра» — длинная фраза годится", () => {
    expect(checkPassword("correct horse battery staple")).toBeNull();
  });

  it(`длиннее ${MAX_PASSWORD_BYTES} байт — ошибка (кириллица — два байта на букву)`, () => {
    expect(checkPassword("a".repeat(72))).toBeNull();
    expect(checkPassword("a".repeat(73))).not.toBeNull();
    expect(checkPassword("я".repeat(37))).not.toBeNull();
  });

  it("повтор не совпал — ошибка у поля повтора", () => {
    expect(checkNewPassword("длинный-пароль", "длинный-пароль!")).toEqual({
      field: "repeat",
      message: "Пароли не совпадают.",
    });
    expect(checkNewPassword("длинный-пароль", "длинный-пароль")).toBeNull();
  });
});

describe("формы целиком — первая ошибка по порядку полей", () => {
  it("регистрация", () => {
    expect(checkSignUp("bad", "short", "x")?.field).toBe("email");
    expect(checkSignUp("max@gmail.com", "short", "x")?.field).toBe("password");
    expect(checkSignUp("max@gmail.com", "long-enough", "other")?.field).toBe("repeat");
    expect(checkSignUp("max@gmail.com", "long-enough", "long-enough")).toBeNull();
  });

  it("вход: длину пароля не проверяем — только что он есть", () => {
    expect(checkSignIn("max@gmail.com", "")?.field).toBe("password");
    expect(checkSignIn("max@gmail.com", "short")).toBeNull();
    expect(checkSignIn("", "whatever")?.field).toBe("email");
  });
});
