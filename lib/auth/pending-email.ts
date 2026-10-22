/**
 * Почта, на которую только что ушло письмо, — между формой и «Проверь почту».
 *
 * Раньше она ехала в адресе (/auth/check-email?email=…) и оседала в истории
 * браузера, журналах сервера и Referer. Теперь — httpOnly-cookie на час и
 * только для /auth: странице нужно показать адрес и отправить письмо ещё
 * раз, а больше она никому не нужна.
 */

import { MAX_EMAIL } from "./validation";

export const PENDING_EMAIL_COOKIE = "tgt-pending-email";
export const PENDING_EMAIL_TTL_SECONDS = 60 * 60;

export function pendingEmailCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/auth",
    maxAge: PENDING_EMAIL_TTL_SECONDS,
  };
}

/**
 * Значение cookie — или null, если это не похоже на адрес. Next кодирует и
 * раскодирует значение сам, здесь оно уже в исходном виде.
 */
export function readPendingEmail(value: string | undefined): string | null {
  if (!value) return null;
  return value.length <= MAX_EMAIL && /^[^\s@]+@[^\s@]+$/.test(value) ? value : null;
}
