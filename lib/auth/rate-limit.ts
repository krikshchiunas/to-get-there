/**
 * Лимит попыток входа, регистрации, сброса пароля и повторного письма.
 *
 * Считает Postgres (public.auth_attempt, 0043) — общий для всех серверов,
 * а не память одного процесса: на Vercel каждый запрос может прийти в
 * свежий экземпляр функции. Пределы — в миграции, здесь — только ключи.
 *
 * В базу уходят не адрес и не почта, а HMAC от них на секретном ключе
 * сервера: журнал попыток не выдаёт, кто и откуда пытался войти.
 *
 * Если серверного ключа нет (SUPABASE_SECRET_KEY) или база не ответила,
 * попытка пропускается, а в журнал пишется предупреждение. Запирать всех
 * снаружи из-за сбоя лимитера хуже, чем на время остаться с лимитами
 * GoTrue. Это осознанный выбор, он записан в docs/AUTH.md.
 */

import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type LimitedOperation = "sign_in" | "sign_up" | "password_reset" | "resend_confirmation";

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

function serverSecret(): string | null {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

/** Ключ бакета: HMAC-SHA256, первые 32 шестнадцатеричных знака. */
export function limiterKey(secret: string, kind: "ip" | "email", value: string): string {
  return createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex").slice(0, 32);
}

let warned = false;
function warnOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.warn(JSON.stringify({ evt: "auth_rate_limit_unavailable", reason }));
}

export async function checkAuthRateLimit(
  operation: LimitedOperation,
  subject: { address: string | null; email: string | null },
): Promise<LimitResult> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS !== "false") return { allowed: true };

  const secret = serverSecret();
  if (!secret) {
    warnOnce("no server key");
    return { allowed: true };
  }

  try {
    const { data, error } = await createAdminClient().rpc("auth_attempt", {
      operation,
      ip_key: subject.address ? limiterKey(secret, "ip", subject.address) : null,
      email_key: subject.email ? limiterKey(secret, "email", subject.email) : null,
    });
    if (error) {
      warnOnce(`rpc ${error.code ?? "error"}`);
      return { allowed: true };
    }
    const wait = typeof data === "number" ? data : 0;
    return wait > 0 ? { allowed: false, retryAfterSeconds: wait } : { allowed: true };
  } catch {
    warnOnce("rpc threw");
    return { allowed: true };
  }
}
