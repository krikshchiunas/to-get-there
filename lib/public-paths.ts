/**
 * Что открыто без входа. Остальное middleware отправляет на /auth/login.
 *
 *   /auth/*       вход, регистрация, подтверждение почты;
 *   /legal/*      Impressum и Datenschutzerklärung — по закону (DDG § 5,
 *                 DSGVO ст. 13) их должно быть видно до регистрации;
 *   /api/health   мониторинг.
 */
const PUBLIC_PREFIXES = ["/auth", "/legal", "/api/health"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
