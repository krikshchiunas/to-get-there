import { describe, expect, it } from "vitest";
import { clientIpFrom, isIpAddress } from "./client-ip";
import { fieldFailure, formFailure, formSuccess, initialFormState } from "./form-state";
import {
  PENDING_EMAIL_COOKIE,
  pendingEmailCookieOptions,
  PENDING_EMAIL_TTL_SECONDS,
  readPendingEmail,
} from "./pending-email";
import { isSessionCookie, isSessionTokenCookie } from "./session-cookies";

describe("clientIpFrom — IP человека для лимитов Auth", () => {
  it("первый адрес X-Forwarded-For — ближайший к человеку", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("иначе X-Real-IP, иначе ничего", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIpFrom(new Headers())).toBeNull();
  });

  it("мусор вместо адреса не пересылается", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "evil, 1.2.3.4" }))).toBeNull();
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "999.1.1.1" }))).toBeNull();
    expect(isIpAddress("1.2.3")).toBe(false);
    expect(isIpAddress("::1")).toBe(true);
  });
});

describe("pending email — почта между формой и «Проверь почту»", () => {
  it("httpOnly, только /auth, час", () => {
    expect(pendingEmailCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/auth",
      maxAge: PENDING_EMAIL_TTL_SECONDS,
    });
    expect(PENDING_EMAIL_TTL_SECONDS).toBe(3600);
    expect(PENDING_EMAIL_COOKIE).toBe("tgt-pending-email");
  });

  it("читает только то, что похоже на адрес", () => {
    expect(readPendingEmail("a@b.de")).toBe("a@b.de");
    expect(readPendingEmail(undefined)).toBeNull();
    expect(readPendingEmail("<script>")).toBeNull();
    expect(readPendingEmail(`${"a".repeat(300)}@b.de`)).toBeNull();
  });
});

describe("cookie сессии Supabase", () => {
  it.each(["sb-127-auth-token", "sb-ntcksmrytrknwhyupzot-auth-token.0", "sb-abc-auth-token.12"])(
    "%s — сама сессия",
    (name) => {
      expect(isSessionTokenCookie(name)).toBe(true);
      expect(isSessionCookie(name)).toBe(true);
    },
  );

  it("code-verifier — не сессия, но выход его тоже стирает", () => {
    expect(isSessionTokenCookie("sb-abc-auth-token-code-verifier")).toBe(false);
    expect(isSessionCookie("sb-abc-auth-token-code-verifier")).toBe(true);
  });

  it.each(["tgt-recovery", "tgt-pending-email", "sb-abc-other", "xsb-abc-auth-token"])(
    "%s — не сессия",
    (name) => {
      expect(isSessionCookie(name)).toBe(false);
    },
  );
});

describe("form state", () => {
  it("начальное — без ошибок", () => {
    expect(initialFormState).toMatchObject({ status: "idle", fieldErrors: {}, formError: null });
  });

  it("ошибка поля, общая ошибка и успех", () => {
    expect(fieldFailure("a@b.de", { email: "x" })).toMatchObject({ status: "error", email: "a@b.de" });
    expect(formFailure("", "boom", { unconfirmed: true })).toMatchObject({
      formError: "boom",
      unconfirmed: true,
    });
    expect(formSuccess("готово")).toMatchObject({ status: "success", notice: "готово", email: "" });
  });
});
