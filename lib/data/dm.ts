/**
 * Личная переписка.
 *
 * Представление `public.direct_conversations` из миграции 0010 делает ровно
 * это одним запросом, но опирается на `current_user_id()`, который без
 * сессии равен NULL. До этапа 6 список собирается в коде по тому же
 * `conversation_key`, что и в представлении.
 */

import { createClient } from "@/lib/supabase/server";
import type { ConversationView, DirectMessage, UserView } from "@/lib/types";
import { isFriend } from "@/lib/types";
import { getViewerId } from "./session";
import { getUserById } from "./people";

/** Тот же ключ, что считает генерируемая колонка в 0005. */
export function conversationKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Повторяет privacy_settings.who_can_message получателя. */
export function canMessage(partner: UserView): boolean {
  switch (partner.privacy_settings.who_can_message) {
    case "everyone":
      return true;
    case "friends":
      return isFriend(partner);
    case "nobody":
      return false;
  }
}

export async function getThread(partnerId: string): Promise<DirectMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("direct_messages")
    .select("*")
    .eq("conversation_key", conversationKey(getViewerId(), partnerId))
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    content: row.content,
    media_url: row.media_url,
    created_at: row.created_at,
  }));
}

export async function getConversations(): Promise<ConversationView[]> {
  const supabase = await createClient();
  const viewerId = getViewerId();

  const { data } = await supabase
    .from("direct_messages")
    .select("*")
    .or(`sender_id.eq.${viewerId},receiver_id.eq.${viewerId}`)
    .order("created_at", { ascending: false });

  // Последнее сообщение на собеседника: выборка уже по убыванию времени,
  // поэтому первое встреченное и есть последнее.
  const latest = new Map<string, (typeof rows)[number]>();
  const rows = data ?? [];
  for (const row of rows) {
    const partnerId = row.sender_id === viewerId ? row.receiver_id : row.sender_id;
    if (!latest.has(partnerId)) latest.set(partnerId, row);
  }

  const conversations = await Promise.all(
    [...latest.entries()].map(async ([partnerId, row]) => {
      const partner = await getUserById(partnerId);
      if (!partner) return null;
      return {
        partner,
        last_message: {
          id: row.id,
          sender_id: row.sender_id,
          receiver_id: row.receiver_id,
          content: row.content,
          media_url: row.media_url,
          created_at: row.created_at,
        },
        // Счётчик непрочитанных читается через
        // rpc("unread_direct_count"), но она берёт зрителя из сессии и до
        // этапа 6 вернёт ноль. Показываем ноль честно, а не выдуманное.
        unread_count: 0,
        can_reply: canMessage(partner),
      } satisfies ConversationView;
    }),
  );

  return conversations
    .filter((item): item is ConversationView => item !== null)
    .sort((a, b) => b.last_message.created_at.localeCompare(a.last_message.created_at));
}

/** Точка в навигации. До входа считать нечего — см. комментарий выше. */
export async function getUnreadDirectTotal(): Promise<number> {
  return 0;
}
