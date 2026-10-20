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

/** Пределы пароля — те же, что при регистрации. */
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72;

/** Ошибка нового пароля словами пользователя или null, если пароль годится. */
export function checkNewPassword(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD) return `Пароль должен быть не короче ${MIN_PASSWORD} символов.`;
  // bcrypt в GoTrue смотрит только на первые 72 байта: длиннее — обман.
  if (new TextEncoder().encode(password).length > MAX_PASSWORD) {
    return `Пароль должен быть не длиннее ${MAX_PASSWORD} байт — примерно ${MAX_PASSWORD} латинских символов.`;
  }
  if (password !== repeat) return "Пароли не совпадают.";
  return null;
}
