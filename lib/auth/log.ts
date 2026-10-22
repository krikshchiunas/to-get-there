/**
 * Журнал подсистемы входа — одна строка JSON на событие.
 *
 * Что в нём есть: операция, итог, категория отказа, маршрут, id запроса,
 * время. Чего нет и быть не может: почты, адреса, паролей, токенов, ссылок
 * из писем. Запись собирается только из перечисленных полей — лишнее,
 * переданное по ошибке, отбрасывается (lib/auth/log.test.ts).
 */

import type { AuthFailure } from "./errors";

export type AuthOperation =
  | "sign_in"
  | "sign_up"
  | "sign_out"
  | "password_reset_request"
  | "password_update"
  | "resend_confirmation"
  | "email_link"
  | "profile_repair";

export type AuthOutcome = "ok" | "failure" | "rate_limited";

export interface AuthEvent {
  op: AuthOperation;
  outcome: AuthOutcome;
  category?: AuthFailure;
  route: string;
  requestId: string;
}

/** Запись, которая уйдёт в журнал: только разрешённые поля. */
export function authLogRecord(event: AuthEvent, now: Date = new Date()): Record<string, string> {
  const record: Record<string, string> = {
    evt: "auth",
    ts: now.toISOString(),
    op: event.op,
    outcome: event.outcome,
    // Маршрут — без query: в ней бывают токены и почта.
    route: event.route.split("?")[0].slice(0, 64),
    requestId: event.requestId.slice(0, 128),
  };
  if (event.category) record.category = event.category;
  return record;
}

export function logAuthEvent(event: AuthEvent): void {
  const line = JSON.stringify(authLogRecord(event));
  if (event.outcome === "ok") console.info(line);
  else console.warn(line);
}
