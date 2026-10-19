"use server";

/** Личные сообщения. Кому можно писать, решает who_can_message получателя (RLS). */

import { revalidatePath } from "next/cache";
import { fail, getActor, noActor, type ActionResult } from "@/lib/actions/actor";
import { invalidInput, isUuid, optionalUuid } from "@/lib/validate";

const MAX_MESSAGE = 2000;

/**
 * Фото в личке пока нет: принимать media_url без загрузки и проверки пути
 * значило бы разрешить записать в базу любую ссылку. Поэтому только текст.
 */
export async function sendDirectMessage(
  receiverId: string,
  content: string,
  replyToId: string | null = null,
): Promise<ActionResult<{ id: string; created_at: string }>> {
  const actor = await getActor();
  if (!actor) return noActor();

  const reply = optionalUuid(replyToId);
  if (!isUuid(receiverId) || typeof content !== "string" || !reply.ok) return invalidInput;
  if (receiverId === actor.viewerId) return { ok: false, error: "Себе написать нельзя." };

  const text = content.trim();
  if (!text) return { ok: false, error: "Пустое сообщение не отправить." };
  if (text.length > MAX_MESSAGE) return { ok: false, error: `Сообщение — не больше ${MAX_MESSAGE} символов.` };

  const { data, error } = await actor.supabase
    .from("direct_messages")
    .insert({ sender_id: actor.viewerId, receiver_id: receiverId, content: text, reply_to_id: reply.value })
    .select("id, created_at")
    .single();

  if (error || !data) {
    if (error?.code === "42501") {
      return { ok: false, error: "Этот человек сейчас не принимает сообщения от тебя." };
    }
    return fail(error);
  }

  revalidatePath("/messages");
  return { ok: true, data };
}

/** Удалить своё сообщение — у обоих, как «Удалить для всех» в мессенджерах. */
export async function deleteDirectMessage(messageId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!isUuid(messageId)) return invalidInput;

  // RLS direct_messages_delete_sender: только отправитель.
  const { error, count } = await actor.supabase
    .from("direct_messages")
    .delete({ count: "exact" })
    .eq("id", messageId);

  if (error) return fail(error);
  if (!count) return { ok: false, error: "Удалить можно только своё сообщение." };

  revalidatePath("/messages", "layout");
  return { ok: true };
}

/** Открыл переписку — всё, что прислал собеседник, прочитано. */
export async function markConversationRead(partnerId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!isUuid(partnerId)) return invalidInput;

  const { error } = await actor.supabase.rpc("mark_conversation_read", { partner: partnerId });
  if (error) return fail(error);

  revalidatePath("/messages");
  return { ok: true };
}
