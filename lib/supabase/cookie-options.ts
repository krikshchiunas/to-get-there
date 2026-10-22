/**
 * Cookie сессии Supabase — одни и те же у middleware, сервера и браузера.
 *
 * @supabase/ssr по умолчанию ставит path=/, SameSite=Lax и год жизни, но не
 * Secure. На проде сессия не должна уходить по http даже до того, как HSTS
 * сработает в браузере, поэтому Secure — всегда в продакшен-сборке (Chrome
 * принимает Secure-cookie и на http://localhost, так что `next start`
 * локально и E2E тоже работают).
 *
 * httpOnly остаётся выключенным намеренно: браузерный клиент Supabase берёт
 * токен из cookie для Realtime и загрузки файлов. От кражи через XSS
 * защищает CSP с nonce (lib/csp.ts), а от использования украденного токена
 * после выхода — проверка живой сессии в базе (0043).
 */
export const sessionCookieOptions = {
  secure: process.env.NODE_ENV === "production",
} as const;
