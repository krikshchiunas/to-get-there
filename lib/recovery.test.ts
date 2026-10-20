import { describe, expect, it } from "vitest";
import { checkNewPassword, recoveryCookieOptions, recoveryMatches, RECOVERY_TTL_SECONDS } from "./recovery";

describe("recoveryMatches — метка восстановления", () => {
  it("подходит только тому же аккаунту", () => {
    expect(recoveryMatches("u1", "u1")).toBe(true);
    expect(recoveryMatches("u1", "u2")).toBe(false);
  });

  it("без метки или без сессии — нет", () => {
    expect(recoveryMatches(undefined, "u1")).toBe(false);
    expect(recoveryMatches("u1", undefined)).toBe(false);
    expect(recoveryMatches("", "")).toBe(false);
  });
});

describe("recoveryCookieOptions", () => {
  it("httpOnly, только для /auth и на 15 минут", () => {
    const options = recoveryCookieOptions(true);
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/auth" });
    expect(options.maxAge).toBe(RECOVERY_TTL_SECONDS);
    expect(RECOVERY_TTL_SECONDS).toBe(900);
  });

  it("secure зависит от протокола — локально по http cookie тоже ставится", () => {
    expect(recoveryCookieOptions(false).secure).toBe(false);
  });
});

describe("checkNewPassword", () => {
  it("короткий пароль", () => {
    expect(checkNewPassword("1234567", "1234567")).toMatch(/не короче 8/);
  });

  it("длиннее 72 байт — bcrypt молча обрезал бы его", () => {
    const long = "я".repeat(37); // 74 байта
    expect(checkNewPassword(long, long)).toMatch(/72/);
  });

  it("повтор не совпал", () => {
    expect(checkNewPassword("длинный-пароль", "длинный-пароль!")).toBe("Пароли не совпадают.");
  });

  it("годный пароль", () => {
    expect(checkNewPassword("correct horse battery", "correct horse battery")).toBeNull();
  });
});
