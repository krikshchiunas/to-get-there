/**
 * Вебхук Stripe Identity: итог проверки личности.
 *
 * Доверяем только подписи (STRIPE_WEBHOOK_SECRET): кто угодно может прислать
 * POST сюда, но без подписи Stripe событие отклоняется, а старое — тоже
 * (повтор перехваченного запроса). user_id берётся из metadata сессии,
 * которую создавал наш сервер, — снаружи его не подставить.
 *
 * Отвечаем 200 на всё, что прочитали, даже если событие не про нас:
 * иначе Stripe будет повторять его сутками.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identityConfigured, outcomeOf, verifyStripeSignature } from "@/lib/stripe-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Больше этого вебхук Identity не бывает; длиннее — не от Stripe. */
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  if (!identityConfigured()) {
    return NextResponse.json({ error: "identity verification is not configured" }, { status: 503 });
  }

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });

  const payload = await request.text();
  if (payload.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });

  const signature = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(payload, signature, process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const outcome = outcomeOf(event);
  if (!outcome) return NextResponse.json({ received: true, ignored: true });

  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_verification_result", {
    session_id: outcome.sessionId,
    member: outcome.userId,
    new_status: outcome.status,
    error_code: outcome.errorCode ?? undefined,
  });

  if (error) {
    // 500 — пусть Stripe повторит: сбой на нашей стороне, итог не записан.
    console.error("stripe webhook: apply_verification_result failed", error.code);
    return NextResponse.json({ error: "store failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
