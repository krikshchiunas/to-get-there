"use server";

/** Личные сообщения. Кому можно писать, решает who_can_message получателя (RLS). */

import { revalidatePath } from "next/cache";
import { fail, getActor, notSignedIn, type ActionResult } from "@/lib/actions/actor";

const MAX_MESSAGE = 2000;

export async function sendDirectMessage(
  receiverId: string,
  content: string,
  mediaUrl: string | null = null,
): Promise<ActionResult<{ id: string; created_at: string }>> {
  const actor = await getActor();
  if (!actor) return notSignedIn;
  if (receiverId === actor.viewerId) return { ok: false, error: "Себе написать нельзя." };

  const text = content.trim();
  if (!text && !mediaUrl) return { ok: false, error: "Пустое сообщение не отправить." };
  if (text.length > MAX_MESSAGE) return { ok: false, error: `Сообщение — не больше ${MAX_MESSAGE} символов.` };

  const { data, error } = await actor.supabase
    .from("direct_messages")
    .insert({ sender_id: actor.viewerId, receiver_id: receiverId, content: text, media_url: mediaUrl })
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

/** Открыл переписку — всё, что прислал собеседник, прочитано. */
export async function markConversationRead(partnerId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  const { error } = await actor.supabase.rpc("mark_conversation_read", { partner: partnerId });
  if (error) return fail(error);

  revalidatePath("/messages");
  return { ok: true };
}
