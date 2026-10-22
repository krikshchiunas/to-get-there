import { describe, expect, it } from "vitest";
import {
  emailProblem,
  hasErrors,
  MAX_EMAIL,
  normalizeEmail,
  passwordProblem,
  readPassword,
  validateLogin,
  validateNewPassword,
  validatePasswordChange,
  validateSignup,
} from "./validation";

describe("normalizeEmail / readPassword", () => {
  it("почта — без краевых пробелов и строчными, как её хранит Auth", () => {
    expect(normalizeEmail("  Ivan.Petrov@TU-Berlin.DE ")).toBe("ivan.petrov@tu-berlin.de");
  });

  it("не строка — пустая строка, а не исключение", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(42)).toBe("");
    expect(readPassword(undefined)).toBe("");
  });

  it("пароль не обрезается: пробелы — его часть", () => {
    expect(readPassword("  фраза из слов  ")).toBe("  фраза из слов  ");
  });
});

describe("emailProblem", () => {
  it.each(["name@gmail.com", "ivan.petrov+tgt@tu-berlin.de", "a@b.co"])("принимает %s", (email) => {
    expect(emailProblem(email)).toBeNull();
  });

  it.each([
    ["", /Введи почту/],
    ["name", /целиком/],
    ["name@", /целиком/],
    ["name@gmail", /целиком/],
    ["na me@gmail.com", /целиком/],
    ["name@gmail.c", /целиком/],
  ])("отклоняет «%s»", (email, message) => {
    expect(emailProblem(email)).toMatch(message);
  });

  it("слишком длинный адрес", () => {
    expect(emailProblem(`${"a".repeat(MAX_EMAIL)}@x.de`)).toMatch(/длинный/);
  });
});

describe("passwordProblem — только длина, без «заглавной и спецсимвола»", () => {
  it("пустой и короткий", () => {
    expect(passwordProblem("")).toMatch(/Придумай/);
    expect(passwordProblem("1234567")).toMatch(/не короче 8/);
  });

  it("восемь символов — годится, даже без цифр и регистра", () => {
    expect(passwordProblem("абвгдежз")).toBeNull();
    expect(passwordProblem("correct horse battery")).toBeNull();
  });

  it("длину считают символами, а не байтами UTF-16", () => {
    expect(passwordProblem("😀😀😀😀😀😀😀")).toMatch(/не короче/);
  });

  it("длиннее 72 байт — bcrypt молча обрезал бы его", () => {
    expect(passwordProblem("я".repeat(37))).toMatch(/72/); // 74 байта
    expect(passwordProblem("a".repeat(72))).toBeNull();
  });
});

describe("validateLogin", () => {
  it("пустые поля — ошибка у каждого", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "Введи почту.",
      password: "Введи пароль.",
    });
  });

  it("длину старого пароля при входе не проверяем — это скажет Auth", () => {
    expect(validateLogin({ email: "a@b.de", password: "123" })).toEqual({});
  });
});

describe("validateSignup", () => {
  const ok = { email: "new@gmail.com", password: "long enough", repeat: "long enough", terms: true };

  it("всё верно — ошибок нет", () => {
    expect(hasErrors(validateSignup(ok))).toBe(false);
  });

  it("без согласия с условиями аккаунт не создать", () => {
    expect(validateSignup({ ...ok, terms: false }).terms).toMatch(/подтверди возраст/);
  });

  it("повтор не совпал", () => {
    expect(validateSignup({ ...ok, repeat: "long enough!" })).toEqual({ repeat: "Пароли не совпадают." });
  });

  it("пустой повтор — просьба повторить", () => {
    expect(validateSignup({ ...ok, repeat: "" }).repeat).toBe("Повтори пароль.");
  });

  it("плохой пароль — одна ошибка, не две", () => {
    const errors = validateSignup({ ...ok, password: "short", repeat: "other" });
    expect(errors.password).toMatch(/не короче/);
    expect(errors.repeat).toBeUndefined();
  });
});

describe("validateNewPassword", () => {
  it("годный и совпадающий", () => {
    expect(validateNewPassword("correct horse battery", "correct horse battery")).toEqual({});
  });

  it("повтор не совпал", () => {
    expect(validateNewPassword("длинный-пароль", "длинный-пароль!")).toEqual({
      repeat: "Пароли не совпадают.",
    });
  });

  it("короткий", () => {
    expect(validateNewPassword("1234567", "1234567").password).toMatch(/не короче 8/);
  });
});

describe("validatePasswordChange", () => {
  it("нужен текущий пароль", () => {
    expect(validatePasswordChange({ current: "", password: "new password", repeat: "new password" })).toEqual(
      {
        current: "Введи текущий пароль.",
      },
    );
  });

  it("новый совпадает с текущим", () => {
    expect(
      validatePasswordChange({ current: "same password", password: "same password", repeat: "same password" })
        .password,
    ).toMatch(/отличаться/);
  });

  it("всё верно", () => {
    expect(
      validatePasswordChange({ current: "old password", password: "new password", repeat: "new password" }),
    ).toEqual({});
  });
});
