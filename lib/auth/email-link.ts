/**
 * Ссылка из письма с `token_hash` (/auth/confirm): какой токен спросить у
 * Supabase. Вид токена приходит из адреса и ничего не разрешает сам по
 * себе — пустит ли он, решает verifyOtp.
 */

export type EmailLinkType = "recovery" | "signup" | "email";

export function emailLinkType(raw: unknown): EmailLinkType {
  if (raw === "recovery") return "recovery";
  if (raw === "signup") return "signup";
  return "email";
}

/** Похоже ли на токен: непустой и без мусора (у PKCE-токенов есть префикс `pkce_`). */
export function plausibleTokenHash(raw: unknown): raw is string {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(raw);
}
