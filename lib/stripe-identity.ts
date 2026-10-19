/**
 * Stripe Identity без SDK: две вещи, которые нужны приложению, — создать
 * сессию проверки и проверить подпись вебхука. Чистые функции, чтобы их
 * можно было проверить тестами без сети и без ключей.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export { explainVerificationError } from "./verification-text";

export type VerificationStatus = "pending" | "processing" | "verified" | "requires_input" | "canceled";

/** Подключено ли всё, без чего проверка не может закончиться. */
export function identityConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

/* ── подпись вебхука ──────────────────────────────────────────────── */

/** Сколько секунд вебхук считается свежим: защита от повтора старого. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Проверка заголовка Stripe-Signature: `t=<время>,v1=<hmac>[,v1=...]`.
 * HMAC-SHA256 от `${t}.${тело}` секретом вебхука, сравнение за постоянное
 * время. Тело — ровно те байты, что пришли, без JSON.parse и обратно.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((item) => item?.trim());
    if (key === "t" && value && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === "v1" && value && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Подпись так, как её ставит Stripe, — для тестов и локальной отладки. */
export function signStripePayload(payload: string, secret: string, timestamp: number): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/* ── события ──────────────────────────────────────────────────────── */

export interface VerificationOutcome {
  sessionId: string;
  userId: string;
  status: Exclude<VerificationStatus, "pending">;
  errorCode: string | null;
}

const STATUS_BY_EVENT: Record<string, VerificationOutcome["status"]> = {
  "identity.verification_session.processing": "processing",
  "identity.verification_session.verified": "verified",
  "identity.verification_session.requires_input": "requires_input",
  "identity.verification_session.canceled": "canceled",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Что из события важно базе. null — событие не про итог проверки или в нём
 * нет нашего user_id (сессию создавали не мы) — его просто подтверждаем.
 */
export function outcomeOf(event: unknown): VerificationOutcome | null {
  if (!event || typeof event !== "object") return null;
  const { type, data } = event as { type?: unknown; data?: { object?: unknown } };
  if (typeof type !== "string" || !(type in STATUS_BY_EVENT)) return null;

  const session = data?.object as
    | { id?: unknown; metadata?: { user_id?: unknown }; last_error?: { code?: unknown } | null }
    | undefined;
  const sessionId = session?.id;
  const userId = session?.metadata?.user_id;
  if (typeof sessionId !== "string" || !sessionId.startsWith("vs_")) return null;
  if (typeof userId !== "string" || !UUID_RE.test(userId)) return null;

  const code = session?.last_error?.code;
  return {
    sessionId,
    userId,
    status: STATUS_BY_EVENT[type],
    errorCode: typeof code === "string" ? code.slice(0, 64) : null,
  };
}

/* ── создание сессии ──────────────────────────────────────────────── */

/** Тело запроса к Stripe: form-urlencoded с вложенными ключами. */
export function sessionRequestBody(userId: string, returnUrl: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set("type", "document");
  body.set("client_reference_id", userId);
  body.set("metadata[user_id]", userId);
  body.set("return_url", returnUrl);
  body.set("options[document][require_matching_selfie]", "true");
  body.set("options[document][require_live_capture]", "true");
  for (const type of ["passport", "id_card", "driving_license"]) {
    body.append("options[document][allowed_types][]", type);
  }
  return body;
}

export async function createVerificationSession(
  secretKey: string,
  userId: string,
  returnUrl: string,
  idempotencyKey: string,
): Promise<{ id: string; url: string }> {
  const response = await fetch("https://api.stripe.com/v1/identity/verification_sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body: sessionRequestBody(userId, returnUrl),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as { id?: string; url?: string } | null;
  if (!response.ok || !json?.id || !json.url) {
    throw new Error(`stripe identity: HTTP ${response.status}`);
  }
  return { id: json.id, url: json.url };
}
