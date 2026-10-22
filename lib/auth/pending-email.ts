/**
 * «Куда мы отправили письмо» — между формой и экраном «Проверь почту».
 *
 * Раньше адрес ехал в строке запроса (/auth/check-email?email=…) и
 * оседал в журналах хостинга и в истории браузера. Теперь — в httpOnly
 * cookie на час, только для /auth: адрес видит лишь сам человек на экране
 * «Проверь почту» и в форме повторной отправки.
 */

export const PENDING_EMAIL_COOKIE = "tgt-pending-email";

export function pendingEmailCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/auth",
    maxAge: 60 * 60,
  };
}
