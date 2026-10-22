/**
 * Сброс пароля: метка «пришёл по ссылке из письма».
 *
 * Сменить пароль без старого можно только тому, кто открыл ссылку
 * восстановления. Сессии самой по себе мало: тот, кто завладел открытым
 * ноутбуком или cookie, иначе мог бы сменить пароль и запереть владельца
 * снаружи. Поэтому возврат из письма (app/auth/callback, app/auth/confirm)
 * ставит короткоживущую httpOnly-метку с id аккаунта, а форма нового пароля
 * принимает только того, чья сессия совпадает с меткой.
 */

export const RECOVERY_COOKIE = "tgt-recovery";

/** Столько живёт метка — и столько есть, чтобы ввести новый пароль. */
export const RECOVERY_TTL_SECONDS = 15 * 60;

export const RESET_PATH = "/auth/reset";
export const RESET_DONE_PATH = "/auth/reset/done";

/** Ссылка из письма сброса в Supabase живёт час (mailer_otp_exp). */
export const RECOVERY_LINK_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Письмо сброса этому аккаунту действительно уходило недавно.
 *
 * Тип ссылки (`type=recovery`) приходит из адресной строки, и решать по
 * нему одному, ставить ли метку, нельзя. `recovery_sent_at` пишет сам
 * Supabase, когда отправляет письмо, — это проверка на стороне сервера.
 */
export function recoveryRequestedRecently(
  sentAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!sentAt) return false;
  const sent = Date.parse(sentAt);
  if (Number.isNaN(sent)) return false;
  return sent <= now + 60_000 && now - sent <= RECOVERY_LINK_MAX_AGE_MS;
}

/**
 * `secure` — в продакшене всегда: Chrome принимает Secure-cookie и на
 * http://localhost, поэтому локальный `next start` тоже работает.
 */
export function recoveryCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/auth",
    maxAge: RECOVERY_TTL_SECONDS,
  };
}

/** Метка подходит, только если её поставили этому же аккаунту. */
export function recoveryMatches(cookieValue: string | undefined, userId: string | undefined): boolean {
  return Boolean(cookieValue && userId && cookieValue === userId);
}
