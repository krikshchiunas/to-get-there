import { describe, expect, it } from "vitest";
import {
  AUTH_MESSAGES,
  classifyAuthError,
  linkErrorFromHash,
  worthLogging,
  type AuthFailure,
} from "./errors";

describe("classifyAuthError — по коду Auth", () => {
  it.each<[string, AuthFailure]>([
    ["invalid_credentials", "invalid_credentials"],
    ["email_not_confirmed", "email_not_confirmed"],
    ["user_already_exists", "user_exists"],
    ["email_exists", "user_exists"],
    ["weak_password", "weak_password"],
    ["same_password", "same_password"],
    ["email_address_invalid", "invalid_email"],
    ["email_address_not_authorized", "email_send_failed"],
    ["over_request_rate_limit", "rate_limited"],
    ["signup_disabled", "signup_disabled"],
    ["otp_expired", "link_invalid"],
    ["flow_state_not_found", "link_invalid"],
    ["pkce_code_verifier_not_found", "link_other_browser"],
    ["session_not_found", "session_missing"],
    ["refresh_token_already_used", "session_missing"],
    ["reauthentication_needed", "session_missing"],
  ])("%s → %s", (code, kind) => {
    expect(classifyAuthError({ code, status: 400, message: "whatever" })).toBe(kind);
  });

  it("пароль из утечек — отдельно от просто слабого", () => {
    expect(classifyAuthError({ code: "weak_password", reasons: ["pwned"] })).toBe("leaked_password");
    expect(classifyAuthError({ code: "weak_password", reasons: ["length"] })).toBe("weak_password");
  });

  // Один код — два смысла. «Подожди минуту» про конкретный адрес выдаёт, что
  // аккаунт есть; общий лимит писем — нет. Действия обязаны их различать.
  it("лимит писем на адрес и общий лимит — разные категории", () => {
    expect(
      classifyAuthError({
        code: "over_email_send_rate_limit",
        status: 429,
        message: "For security purposes, you can only request this after 59 seconds.",
      }),
    ).toBe("email_frequency");
    expect(
      classifyAuthError({
        code: "over_email_send_rate_limit",
        status: 429,
        message: "Email rate limit exceeded",
      }),
    ).toBe("email_quota");
  });
});

describe("classifyAuthError — без кода (старые ответы, клиентские ошибки)", () => {
  it.each<[Parameters<typeof classifyAuthError>[0], AuthFailure]>([
    [{ message: "Invalid login credentials" }, "invalid_credentials"],
    [{ message: "Email not confirmed" }, "email_not_confirmed"],
    [{ message: "User already registered" }, "user_exists"],
    [{ message: "Error sending confirmation email" }, "email_send_failed"],
    [{ message: "For security purposes, you can only request this after 30 seconds." }, "email_frequency"],
    [{ message: "Request rate limit reached" }, "rate_limited"],
    [{ status: 429, message: "Too Many Requests" }, "rate_limited"],
    [{ message: "Email link is invalid or has expired" }, "link_invalid"],
    [{ message: "invalid flow state, no valid flow state found" }, "link_invalid"],
    [{ name: "AuthSessionMissingError", message: "Auth session missing!" }, "session_missing"],
    [
      { name: "AuthPKCECodeVerifierMissingError", message: "PKCE code verifier not found" },
      "link_other_browser",
    ],
    [{ message: "Database error saving new user" }, "server"],
    [{}, "server"],
    [null, "server"],
  ])("%j → %s", (error, kind) => {
    expect(classifyAuthError(error)).toBe(kind);
  });
});

describe("AUTH_MESSAGES", () => {
  it("текст для каждой категории, без сообщений сервера", () => {
    for (const message of Object.values(AUTH_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/database|supabase|gotrue|error/i);
    }
  });

  it("неверный пароль не говорит, что именно не так — почта или пароль", () => {
    expect(AUTH_MESSAGES.invalid_credentials).toBe("Неверная почта или пароль.");
  });
});

describe("worthLogging — журнал без шума", () => {
  it("обычные отказы формы не пишутся", () => {
    for (const kind of ["invalid_credentials", "email_frequency", "user_exists", "link_invalid"] as const) {
      expect(worthLogging(kind)).toBe(false);
    }
  });

  it("лимиты и сбои пишутся", () => {
    for (const kind of [
      "rate_limited",
      "email_quota",
      "email_send_failed",
      "server",
      "signup_disabled",
    ] as const) {
      expect(worthLogging(kind)).toBe(true);
    }
  });
});

describe("linkErrorFromHash — ошибка ссылки во фрагменте адреса", () => {
  it("устаревшая или использованная ссылка", () => {
    expect(
      linkErrorFromHash(
        "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=",
      ),
    ).toBe("link_invalid");
  });

  it("ошибка без кода — тоже ссылка", () => {
    expect(linkErrorFromHash("#error=server_error")).toBe("link_invalid");
  });

  it("лимит — отдельно", () => {
    expect(linkErrorFromHash("#error_code=over_request_rate_limit")).toBe("rate_limited");
  });

  it("обычный фрагмент — не ошибка", () => {
    expect(linkErrorFromHash("")).toBeNull();
    expect(linkErrorFromHash("#content")).toBeNull();
  });
});
