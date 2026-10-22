/**
 * Ошибки входа: что произошло (категория) и что сказать человеку.
 *
 * Сообщения Supabase Auth наружу не уходят никогда: в них бывают детали
 * устройства (например, «Database error saving new user»), и по ним можно
 * понять, есть ли аккаунт. Категория — для журнала (lib/auth/log.ts),
 * текст — для экрана.
 */

export type AuthFailure =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_exists"
  | "invalid_email"
  | "weak_password"
  | "same_password"
  | "rate_limited"
  | "link_invalid"
  | "email_send_failed"
  | "signup_disabled"
  | "session_missing"
  | "unknown";

export const AUTH_MESSAGES: Record<AuthFailure, string> = {
  invalid_credentials: "Неверная почта или пароль.",
  email_not_confirmed: "Почта ещё не подтверждена. Открой письмо от To Get There и перейди по ссылке.",
  // Регистрация не говорит «такой аккаунт уже есть» — см. signUp. Это
  // сообщение — только на случай, если категория всё же дойдёт до экрана.
  user_exists: "Не получилось создать аккаунт. Если он у тебя уже есть — войди или восстанови пароль.",
  invalid_email: "Этот адрес почты не принимается. Проверь, что он написан без ошибок.",
  weak_password: "Пароль слишком простой — возьми длиннее или пусть его придумает менеджер паролей.",
  same_password: "Новый пароль должен отличаться от прежнего.",
  rate_limited: "Слишком много попыток. Подожди немного и попробуй снова.",
  link_invalid: "Ссылка недействительна или устарела. Запроси новую.",
  email_send_failed: "Не удалось отправить письмо. Попробуй через несколько минут.",
  signup_disabled: "Регистрация сейчас закрыта.",
  session_missing: "Сессия закончилась. Войди снова.",
  unknown: "Что-то пошло не так. Попробуй ещё раз.",
};

/** Код ошибки Supabase Auth → категория. Коды — из auth-js (ErrorCode). */
const BY_CODE: Record<string, AuthFailure> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "user_exists",
  email_exists: "user_exists",
  email_address_invalid: "invalid_email",
  email_address_not_authorized: "email_send_failed",
  weak_password: "weak_password",
  same_password: "same_password",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
  otp_expired: "link_invalid",
  flow_state_expired: "link_invalid",
  flow_state_not_found: "link_invalid",
  bad_code_verifier: "link_invalid",
  bad_jwt: "session_missing",
  session_not_found: "session_missing",
  session_expired: "session_missing",
  refresh_token_not_found: "session_missing",
  refresh_token_already_used: "session_missing",
  signup_disabled: "signup_disabled",
  email_provider_disabled: "signup_disabled",
};

export interface AuthErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}

/**
 * Категория ошибки. Сначала код (он стабилен), потом — для старых версий
 * GoTrue без кодов — текст сообщения, потом HTTP-статус.
 */
export function classifyAuthError(error: AuthErrorLike | null | undefined): AuthFailure {
  if (!error) return "unknown";
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];

  const m = (error.message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "invalid_credentials";
  if (m.includes("email not confirmed")) return "email_not_confirmed";
  if (m.includes("already registered") || m.includes("already been registered")) return "user_exists";
  if (m.includes("should be different")) return "same_password";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) {
    return "rate_limited";
  }
  if (m.includes("expired") || m.includes("invalid flow state") || m.includes("code verifier")) {
    return "link_invalid";
  }
  if (m.includes("email address") && m.includes("invalid")) return "invalid_email";
  if (m.includes("error sending")) return "email_send_failed";
  if (m.includes("signups not allowed")) return "signup_disabled";

  if (error.status === 429) return "rate_limited";
  return "unknown";
}

/**
 * Отказы GoTrue, по которым видно, есть ли аккаунт: «занят» — очевидно,
 * «слишком часто» — тоже, потому что GoTrue ограничивает частоту писем
 * только адресам, у которых аккаунт есть. Регистрация, сброс и повторное
 * письмо отвечают на них как на успех; о частоте говорит только наш лимит
 * (0043) — он одинаков для любой почты.
 */
export function revealsAccount(failure: AuthFailure): boolean {
  return failure === "user_exists" || failure === "rate_limited";
}

export function authMessage(failure: AuthFailure): string {
  return AUTH_MESSAGES[failure];
}

/** «Через сколько можно ещё раз» — словами, для ответа лимита попыток. */
export function retryMessage(seconds: number): string {
  if (seconds <= 60) return "Слишком много попыток. Подожди минуту и попробуй снова.";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `Слишком много попыток. Попробуй снова через ${minutes} мин.`;
  return "Слишком много попыток. Попробуй снова через час.";
}
