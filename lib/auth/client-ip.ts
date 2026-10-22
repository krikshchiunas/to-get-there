/**
 * IP человека, а не нашего сервера — для лимитов Supabase Auth.
 *
 * Auth считает попытки входа и регистрации по IP. Вход идёт через server
 * actions, поэтому без пересылки Auth видел бы один адрес — сервера — на
 * всех: один перебор паролей исчерпал бы лимит для всех пользователей разом.
 * Адрес человека передаётся заголовком Sb-Forwarded-For (lib/supabase/auth.ts).
 *
 * Верить X-Forwarded-For можно только за прокси, который его перезаписывает:
 * Vercel ставит его сам. Поэтому пересылка включается явно
 * (SUPABASE_AUTH_IP_FORWARDING) и только там, где это так.
 */

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+(%[0-9a-z]+)?$/i;

export function isIpAddress(value: string): boolean {
  if (IPV4.test(value)) return true;
  return value.includes(":") && value.length <= 45 && IPV6.test(value);
}

/** Первый адрес из X-Forwarded-For (его ставит ближайший к человеку прокси), иначе X-Real-IP. */
export function clientIpFrom(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const candidate = (forwarded ? forwarded.split(",")[0] : headers.get("x-real-ip"))?.trim() ?? "";
  return candidate && isIpAddress(candidate) ? candidate : null;
}
