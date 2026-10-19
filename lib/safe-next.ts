/**
 * Куда вернуть после входа — только путь внутри этого приложения.
 *
 * Отдельный модуль, а не часть app/auth/actions.ts: файл с "use server"
 * может экспортировать только асинхронные действия, а эта функция должна
 * покрываться тестами (lib/safe-next.test.ts).
 */
const INTERNAL_ORIGIN = "http://internal.invalid";

export function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";

  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  // Обратный слэш и управляющие символы браузеры нормализуют в `//`.
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return "/";

  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return "/";
  }

  if (url.origin !== INTERNAL_ORIGIN) return "/";
  if (url.pathname.startsWith("/auth")) return "/";
  return url.pathname + url.search + url.hash;
}
