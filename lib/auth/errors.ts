/**
 * Ошибки входа: что случилось — словами человека, а подробности — в журнал.
 *
 * Supabase Auth отвечает кодами (`error.code`), а старые версии — только
 * текстом; разбираем оба. Наружу уходит одна из категорий ниже и её текст,
 * никогда — сообщение сервера: в нём бывают детали, которые человеку не
 * нужны («Database error saving new user»).
 */

export type AuthFailure =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_exists"
  | "weak_password"
  | "leaked_password"
  | "same_password"
  | "invalid_email"
  /** Письмо этому адресу уходило меньше минуты назад. Зависит от того, есть ли аккаунт. */
  | "email_frequency"
  /** Исчерпан общий лимит писем проекта — не зависит от адреса. */
  | "email_quota"
  | "email_send_failed"
  /** Слишком много запросов с этого адреса IP. */
  | "rate_limited"
  | "signup_disabled"
  | "link_invalid"
  /** PKCE: ссылку открыли не в том браузере, где её запросили. */
  | "link_other_browser"
  | "session_missing"
  | "server";

export interface AuthErrorLike {
  code?: string | null;
  status?: number | null;
  message?: string | null;
  name?: string | null;
  reasons?: readonly string[] | null;
}

const BY_CODE: Record<string, AuthFailure> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "user_exists",
  email_exists: "user_exists",
  weak_password: "weak_password",
  same_password: "same_password",
  email_address_invalid: "invalid_email",
  email_address_not_authorized: "email_send_failed",
  over_request_rate_limit: "rate_limited",
  signup_disabled: "signup_disabled",
  email_provider_disabled: "signup_disabled",
  otp_expired: "link_invalid",
  flow_state_expired: "link_invalid",
  flow_state_not_found: "link_invalid",
  bad_code_verifier: "link_invalid",
  pkce_code_verifier_not_found: "link_other_browser",
  session_not_found: "session_missing",
  session_expired: "session_missing",
  refresh_token_not_found: "session_missing",
  refresh_token_already_used: "session_missing",
  // «Безопасная смена пароля» в панели Supabase: сессия старше суток — войти заново.
  reauthentication_needed: "session_missing",
};

export function classifyAuthError(error: AuthErrorLike | null | undefined): AuthFailure {
  if (!error) return "server";
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "weak_password" && error.reasons?.includes("pwned")) return "leaked_password";

  // Один код на два разных случая: «подожди минуту» про конкретный адрес и
  // общий лимит писем проекта. Первое выдаёт, есть ли аккаунт, второе — нет.
  if (code === "over_email_send_rate_limit" || message.includes("security purposes")) {
    return message.includes("security purposes") || /after \d+ seconds?/.test(message)
      ? "email_frequency"
      : "email_quota";
  }

  const known = BY_CODE[code];
  if (known) return known;

  if (error.name === "AuthSessionMissingError") return "session_missing";
  if (error.name === "AuthPKCECodeVerifierMissingError") return "link_other_browser";

  // Старые ответы без кода.
  if (message.includes("invalid login credentials")) return "invalid_credentials";
  if (message.includes("email not confirmed")) return "email_not_confirmed";
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "user_exists";
  }
  if (message.includes("error sending")) return "email_send_failed";
  if (message.includes("rate limit") || error.status === 429) return "rate_limited";
  if (message.includes("expired") || message.includes("invalid flow state")) return "link_invalid";
  return "server";
}

/**
 * Ошибка ссылки из письма, которую Auth передал во фрагменте адреса.
 *
 * На устаревшую или уже использованную ссылку Supabase Auth ведёт не на наш
 * /auth/callback, а на корень сайта с `#error_code=otp_expired…`. Фрагмент
 * до сервера не доходит, поэтому разобрать его может только страница.
 */
export function linkErrorFromHash(hash: string): AuthFailure | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const code = params.get("error_code");
  if (!code && !params.get("error")) return null;
  const kind = classifyAuthError({ code, message: params.get("error_description") });
  return kind === "server" ? "link_invalid" : kind;
}

export const AUTH_MESSAGES: Record<AuthFailure, string> = {
  invalid_credentials: "Неверная почта или пароль.",
  email_not_confirmed:
    "Почта ещё не подтверждена. Открой письмо от To Get There и перейди по ссылке — или отправим письмо ещё раз.",
  // Сюда человек не должен попадать: регистрация с занятым адресом ведёт на
  // «Проверь почту», как и с новым (иначе форма отвечала бы, кто здесь есть).
  user_exists: "Не получилось создать аккаунт. Если он у тебя уже есть — войди или восстанови пароль.",
  weak_password: "Этот пароль слишком простой. Придумай длиннее — например, фразу из нескольких слов.",
  leaked_password: "Этот пароль уже встречался в утечках с других сайтов. Придумай другой.",
  same_password: "Новый пароль должен отличаться от текущего.",
  invalid_email: "Этот адрес почты не принимается. Проверь, что он написан без ошибок.",
  email_frequency: "Письмо уже отправлено. Подожди минуту, прежде чем просить ещё одно.",
  email_quota: "Сейчас мы не можем отправить письмо. Попробуй через несколько минут.",
  email_send_failed: "Не удалось отправить письмо. Попробуй через несколько минут.",
  rate_limited: "Слишком много попыток. Подожди несколько минут и попробуй снова.",
  signup_disabled: "Регистрация сейчас закрыта. Попробуй позже.",
  link_invalid: "Ссылка из письма устарела или уже использована.",
  link_other_browser: "Ссылку открыли не в том браузере, где её запросили.",
  session_missing: "Сессия закончилась. Войди снова.",
  server: "Что-то пошло не так на нашей стороне. Попробуй ещё раз через минуту.",
};

/**
 * Стоит ли писать в журнал. Неверный пароль и «письмо уже отправлено» — это
 * обычная жизнь формы, а не сбой: тысячи таких строк спрятали бы настоящие.
 */
export function worthLogging(kind: AuthFailure): boolean {
  switch (kind) {
    case "invalid_credentials":
    case "email_not_confirmed":
    case "user_exists":
    case "weak_password":
    case "leaked_password":
    case "same_password":
    case "invalid_email":
    case "email_frequency":
    case "link_invalid":
    case "link_other_browser":
    case "session_missing":
      return false;
    default:
      return true;
  }
}
