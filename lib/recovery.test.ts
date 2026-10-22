import { describe, expect, it } from "vitest";
import {
  recoveryCookieOptions,
  recoveryMatches,
  recoveryRequestedRecently,
  RECOVERY_TTL_SECONDS,
} from "./recovery";

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

describe("recoveryRequestedRecently — письмо сброса правда уходило", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");

  it("в пределах часа — да", () => {
    expect(recoveryRequestedRecently("2026-10-22T11:30:00Z", now)).toBe(true);
    expect(recoveryRequestedRecently("2026-10-22T11:00:00Z", now)).toBe(true);
  });

  it("старше часа, не было вовсе или мусор — нет", () => {
    expect(recoveryRequestedRecently("2026-10-22T10:59:00Z", now)).toBe(false);
    expect(recoveryRequestedRecently(undefined, now)).toBe(false);
    expect(recoveryRequestedRecently(null, now)).toBe(false);
    expect(recoveryRequestedRecently("вчера", now)).toBe(false);
  });

  it("из будущего — нет (минута на расхождение часов допустима)", () => {
    expect(recoveryRequestedRecently("2026-10-22T12:00:30Z", now)).toBe(true);
    expect(recoveryRequestedRecently("2026-10-22T13:00:00Z", now)).toBe(false);
  });
});
