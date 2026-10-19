"use server";

/**
 * Начать проверку личности: сессия у Stripe Identity и заявка в базе.
 *
 * Итог сюда не приходит — его присылает Stripe вебхуком
 * (app/api/webhooks/stripe). Отсюда человек только уходит на страницу
 * провайдера, где сам показывает документ и селфи.
 */

import { fail, getActor, notSignedIn, type ActionResult } from "@/lib/actions/actor";
import { siteUrl } from "@/lib/site-url";
import { createVerificationSession, identityConfigured } from "@/lib/stripe-identity";

/** Попыток за сутки: каждая сессия у провайдера стоит денег. */
const ATTEMPTS_PER_DAY = 5;

export async function startVerification(): Promise<ActionResult<{ url: string }>> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  if (!identityConfigured()) {
    return { ok: false, error: "Проверка личности ещё не подключена. Как только подключим — кнопка заработает." };
  }

  const { data: me } = await actor.supabase
    .from("users")
    .select("is_verified")
    .eq("id", actor.viewerId)
    .single();
  if (me?.is_verified) return { ok: false, error: "Личность уже подтверждена." };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await actor.supabase
    .from("verification_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", actor.viewerId)
    .gte("created_at", since);
  if ((count ?? 0) >= ATTEMPTS_PER_DAY) {
    return { ok: false, error: `За сутки — не больше ${ATTEMPTS_PER_DAY} попыток. Попробуй завтра.` };
  }

  let session: { id: string; url: string };
  try {
    session = await createVerificationSession(
      process.env.STRIPE_SECRET_KEY ?? "",
      actor.viewerId,
      `${await siteUrl()}/settings/verification?from=provider`,
      crypto.randomUUID(),
    );
  } catch {
    return { ok: false, error: "Провайдер проверки не ответил. Попробуй через минуту." };
  }

  // Уводим только на страницу Stripe — не на что попало из ответа.
  if (!session.url.startsWith("https://verify.stripe.com/")) {
    return { ok: false, error: "Провайдер вернул странную ссылку. Попробуй ещё раз." };
  }

  const { error } = await actor.supabase
    .from("verification_requests")
    .insert({ user_id: actor.viewerId, provider_session_id: session.id });
  if (error) return fail(error);

  return { ok: true, data: { url: session.url } };
}
