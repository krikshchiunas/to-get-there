/**
 * Журнал входа — та же форма, что у instrumentation.ts: одна строка JSON на
 * событие, её собирает Vercel (Logs, Observability, дрейны).
 *
 * В строке нет ни почты, ни пароля, ни токенов, ни IP: только что за
 * операция, чем кончилась, код ответа Auth и id запроса для поиска по
 * журналам. Обычные отказы (неверный пароль) сюда не попадают вовсе —
 * worthLogging() в lib/auth/errors.ts.
 */

import type { AuthFailure } from "./errors";

export type AuthOperation =
  | "sign_in"
  | "sign_up"
  | "sign_out"
  | "resend_confirmation"
  | "confirm_email"
  | "recovery_request"
  | "recovery_link"
  | "password_update"
  | "password_change"
  | "reauthenticate"
  | "account_delete"
  | "profile_repair";

export interface AuthLogEvent {
  op: AuthOperation;
  kind: AuthFailure | "ok";
  /** HTTP-статус ответа Auth, если он был. */
  status?: number | null;
  /** Код ошибки Auth (`over_request_rate_limit` и т. п.) — не секрет и не личные данные. */
  code?: string | null;
}

export interface AuthLogContext {
  route: string;
  requestId: string | null;
  at: Date;
}

const LEVEL: Partial<Record<AuthFailure | "ok", "warn" | "info">> = {
  rate_limited: "warn",
  email_quota: "warn",
  ok: "info",
};

export function authLogLine(event: AuthLogEvent, context: AuthLogContext): string {
  return JSON.stringify({
    level: LEVEL[event.kind] ?? "error",
    event: "auth",
    op: event.op,
    outcome: event.kind,
    status: event.status ?? null,
    code: event.code ?? null,
    route: context.route,
    request_id: context.requestId,
    at: context.at.toISOString(),
  });
}

/**
 * Id запроса, по которому строку найти в журналах: Vercel ставит
 * x-vercel-id, прокси — x-request-id. Берём только похожее на id, чтобы
 * клиент не мог вписать в журнал произвольный текст.
 */
export function requestIdFrom(headers: Pick<Headers, "get">): string | null {
  const raw = headers.get("x-vercel-id") ?? headers.get("x-request-id");
  if (!raw) return null;
  const value = raw.trim().slice(0, 128);
  return /^[A-Za-z0-9:._-]+$/.test(value) ? value : null;
}
