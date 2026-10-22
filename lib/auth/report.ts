/**
 * Запись в журнал входа из server actions и route handlers.
 *
 * Решает, писать ли (worthLogging), и берёт id запроса из заголовков.
 * Строку собирает чистая authLogLine (lib/auth/log.ts).
 */

import { headers } from "next/headers";
import { classifyAuthError, worthLogging, type AuthErrorLike, type AuthFailure } from "./errors";
import { authLogLine, requestIdFrom, type AuthOperation } from "./log";

async function currentRequestId(): Promise<string | null> {
  try {
    return requestIdFrom(await headers());
  } catch {
    return null;
  }
}

/**
 * Записать отказ Auth и вернуть его категорию. Ошибку можно передать как
 * есть: в строку попадут только код и статус, не сообщение.
 */
export async function reportAuthFailure(
  op: AuthOperation,
  route: string,
  failure: AuthErrorLike | AuthFailure,
): Promise<AuthFailure> {
  const kind = typeof failure === "string" ? failure : classifyAuthError(failure);
  if (!worthLogging(kind)) return kind;

  const detail = typeof failure === "string" ? null : failure;
  const line = authLogLine(
    { op, kind, status: detail?.status ?? null, code: detail?.code ?? null },
    { route, requestId: await currentRequestId(), at: new Date() },
  );
  if (kind === "rate_limited" || kind === "email_quota") console.warn(line);
  else console.error(line);
  return kind;
}

/** Событие, которое стоит видеть и при успехе: починка профиля, выход на всех устройствах. */
export async function reportAuthEvent(op: AuthOperation, route: string): Promise<void> {
  console.info(
    authLogLine({ op, kind: "ok" }, { route, requestId: await currentRequestId(), at: new Date() }),
  );
}
