/**
 * Параметры cookie сессии Supabase — одни для сервера, браузера и middleware.
 *
 * - `secure` в продакшене: сессия ходит только по HTTPS. Локальный
 *   `next start` по http://localhost тоже работает — браузеры считают
 *   localhost безопасным источником.
 * - `sameSite: "lax"`: cookie не уходит с чужих POST-запросов, но ссылка
 *   из письма открывает приложение уже с сессией.
 * - Без `domain`: cookie принадлежит ровно тому хосту, где человек вошёл.
 * - Не `httpOnly` — и это решение @supabase/ssr, а не забывчивость:
 *   браузерному клиенту нужен токен для realtime (lib/live.ts). Защита от
 *   кражи скриптом — CSP с nonce (lib/csp.ts), а права решает сервер и RLS,
 *   а не то, что лежит в cookie.
 */

export const sessionCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
