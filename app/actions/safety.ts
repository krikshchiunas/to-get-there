"use server";

/**
 * Безопасность сообщества: блокировка и жалобы.
 *
 * Что именно делает блокировка, решает база (0029): заблокированный не
 * видит тебя и не может до тебя дотянуться, подписки снимаются. Жалоба
 * (0030) уходит в очередь модерации со снимком содержимого.
 */

import { revalidatePath } from "next/cache";
import { fail, getActor, noActor, type ActionResult } from "@/lib/actions/actor";
import type { ReportReason, ReportTarget } from "@/lib/types";
import { invalidInput, isUuid, oneOf } from "@/lib/validate";

const REPORT_TARGETS: readonly ReportTarget[] = ["user", "post", "message", "direct_message"];
const REPORT_REASONS: readonly ReportReason[] = [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "scam",
  "impersonation",
  "other",
];
const MAX_DETAILS = 1000;

export async function setBlocked(targetId: string, blocked: boolean): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!isUuid(targetId) || typeof blocked !== "boolean") return invalidInput;
  if (targetId === actor.viewerId) return { ok: false, error: "Себя заблокировать нельзя." };

  if (blocked) {
    const { error } = await actor.supabase
      .from("user_blocks")
      .insert({ blocker_id: actor.viewerId, blocked_id: targetId });
    // Уже заблокирован — для человека это не ошибка.
    if (error && error.code !== "23505") return fail(error);
  } else {
    const { error } = await actor.supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", actor.viewerId)
      .eq("blocked_id", targetId);
    if (error) return fail(error);
  }

  // Блокировка меняет ленту, профили, чаты и личку — всё сразу.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function report(
  targetType: ReportTarget,
  targetId: string,
  reason: ReportReason,
  details: string | null = null,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();

  const type = oneOf(targetType, REPORT_TARGETS);
  const why = oneOf(reason, REPORT_REASONS);
  if (!type || !why || !isUuid(targetId)) return invalidInput;
  if (details !== null && typeof details !== "string") return invalidInput;

  const note = details?.trim() || null;
  if (note && note.length > MAX_DETAILS)
    return { ok: false, error: `Пояснение — не больше ${MAX_DETAILS} символов.` };
  if (why === "other" && !note) return { ok: false, error: "Опиши в двух словах, что не так." };

  // reporter_id, снимок и владельца цели ставит триггер reports_prepare.
  const { error } = await actor.supabase
    .from("reports")
    .insert({ target_type: type, target_id: targetId, reason: why, details: note });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ты уже пожаловался на это. Мы разберёмся." };
    if (error.code === "23514") return { ok: false, error: "На себя пожаловаться нельзя." };
    if (error.code === "23503") return { ok: false, error: "Не нашлось — возможно, это уже удалили." };
    return fail(error);
  }
  return { ok: true };
}
