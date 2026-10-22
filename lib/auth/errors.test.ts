import { describe, expect, it } from "vitest";
import {
  AUTH_MESSAGES,
  authMessage,
  classifyAuthError,
  retryMessage,
  revealsAccount,
  type AuthFailure,
} from "./errors";

describe("classifyAuthError — по коду Supabase", () => {
  const cases: Array<[string, AuthFailure]> = [
    ["invalid_credentials", "invalid_credentials"],
    ["email_not_confirmed", "email_not_confirmed"],
    ["user_already_exists", "user_exists"],
    ["email_exists", "user_exists"],
    ["weak_password", "weak_password"],
    ["same_password", "same_password"],
    ["over_request_rate_limit", "rate_limited"],
    ["over_email_send_rate_limit", "rate_limited"],
    ["otp_expired", "link_invalid"],
    ["flow_state_not_found", "link_invalid"],
    ["bad_code_verifier", "link_invalid"],
    ["session_not_found", "session_missing"],
    ["refresh_token_already_used", "session_missing"],
    ["signup_disabled", "signup_disabled"],
    ["email_address_invalid", "invalid_email"],
  ];
  for (const [code, expected] of cases) {
    it(`${code} → ${expected}`, () => {
      expect(classifyAuthError({ code, message: "irrelevant" })).toBe(expected);
    });
  }
});

describe("classifyAuthError — старые сообщения без кода", () => {
  it("по тексту", () => {
    expect(classifyAuthError({ message: "Invalid login credentials" })).toBe("invalid_credentials");
    expect(classifyAuthError({ message: "Email not confirmed" })).toBe("email_not_confirmed");
    expect(classifyAuthError({ message: "User already registered" })).toBe("user_exists");
    expect(classifyAuthError({ message: "New password should be different from the old password." })).toBe(
      "same_password",
    );
    expect(
      classifyAuthError({ message: "For security purposes, you can only request this after 42 seconds." }),
    ).toBe("rate_limited");
    expect(classifyAuthError({ message: "Email link is invalid or has expired" })).toBe("link_invalid");
    expect(classifyAuthError({ message: 'Email address "x@y" is invalid' })).toBe("invalid_email");
    expect(classifyAuthError({ message: "Error sending confirmation email" })).toBe("email_send_failed");
    expect(classifyAuthError({ message: "Signups not allowed for this instance" })).toBe("signup_disabled");
  });

  it("неизвестное — «что-то пошло не так», а не догадка", () => {
    expect(classifyAuthError({ message: "Database error saving new user" })).toBe("unknown");
    expect(classifyAuthError({ code: "never_heard_of_it" })).toBe("unknown");
    expect(classifyAuthError(null)).toBe("unknown");
    expect(classifyAuthError({ status: 429 })).toBe("rate_limited");
  });
});

describe("тексты для экрана", () => {
  it("ни в одном нет технических деталей Supabase и Postgres", () => {
    for (const text of Object.values(AUTH_MESSAGES)) {
      expect(text).not.toMatch(/supabase|postgres|database|sql|jwt|token|gotrue|error/i);
    }
  });

  it("одна категория — один текст", () => {
    expect(authMessage("invalid_credentials")).toBe("Неверная почта или пароль.");
  });

  it("время ожидания — словами", () => {
    expect(retryMessage(30)).toMatch(/минуту/);
    expect(retryMessage(600)).toMatch(/через 10 мин/);
    expect(retryMessage(5000)).toMatch(/через час/);
  });
});

describe("revealsAccount — что нельзя показывать в регистрации, сбросе и повторном письме", () => {
  it("«занят» и «слишком часто» от GoTrue выдают, что аккаунт есть", () => {
    expect(revealsAccount("user_exists")).toBe(true);
    // GoTrue ограничивает частоту писем только существующим аккаунтам.
    expect(revealsAccount("rate_limited")).toBe(true);
  });

  it("остальное от наличия аккаунта не зависит — можно сказать", () => {
    for (const failure of ["invalid_email", "weak_password", "signup_disabled", "unknown"] as const) {
      expect(revealsAccount(failure)).toBe(false);
    }
  });
});
