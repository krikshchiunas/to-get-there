/**
 * Проверка аргументов серверных действий.
 *
 * Server action — публичная точка входа: её можно вызвать запросом с любыми
 * аргументами, а не только из нашей формы. TypeScript здесь ничего не
 * гарантирует — типы стираются при сборке. Поэтому всё, что пришло снаружи,
 * проверяется до похода в базу: неверный id отвечает понятной ошибкой, а не
 * 22P02 из Postgres, а строка вместо числа не роняет действие.
 *
 * Сами права проверяет RLS. Здесь — только форма данных.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Все значения — uuid. Удобно для пары «идея и сообщение». */
export function areUuids(...values: unknown[]): boolean {
  return values.every(isUuid);
}

/** Строка без краевых пробелов; не строка — пустая строка. */
export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Необязательный uuid: null и undefined — «нет», остальное должно быть uuid. */
export function optionalUuid(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, value: null };
  return isUuid(value) ? { ok: true, value } : { ok: false };
}

/** Значение из закрытого списка или null. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export const invalidInput = {
  ok: false as const,
  error: "Запрос не распознан. Обнови страницу и попробуй снова.",
};
