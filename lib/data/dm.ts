/** Личная переписка. */

import { createClient } from "@/lib/supabase/server";
import type { ConversationView, DirectMessage, UserView } from "@/lib/types";
import { isFriend } from "@/lib/types";
import { requireViewerId } from "./session";
import { getUsersByIds } from "./people";

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

/** Последние сообщения переписки — тот же предел и та же причина, что у чата идеи. */
export const THREAD_HISTORY_LIMIT = 300;

export async function getThread(partnerId: string): Promise<DirectMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("direct_messages")
    .select("*")
    .eq("conversation_key", conversationKey(await requireViewerId(), partnerId))
    .order("created_at", { ascending: false })
    .limit(THREAD_HISTORY_LIMIT);

  return (data ?? []).reverse().map((row) => ({
    id: row.id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    content: row.content,
    media_url: row.media_url,
    reply_to_id: row.reply_to_id,
    created_at: row.created_at,
  }));
}

/**
 * Когда собеседник последний раз открывал переписку. null — не открывал
 * или кто-то из двоих выключил «Прочитано»: тогда строку не отдаёт RLS (0032).
 */
export async function getPartnerReadAt(partnerId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("direct_message_reads")
    .select("read_at")
    .eq("user_id", partnerId)
    .eq("partner_id", await requireViewerId())
    .maybeSingle();
  return data?.read_at ?? null;
}

/**
 * Список личных чатов — представление `direct_conversations` (0010/0017):
 * последнее сообщение на собеседника, непрочитанные и можно ли ответить,
 * посчитанные в базе с теми же правилами, что и RLS.
 */
export async function getConversations(): Promise<ConversationView[]> {
  const supabase = await createClient();
  await requireViewerId();

  const { data } = await supabase
    .from("direct_conversations")
    .select("*")
    .order("last_created_at", { ascending: false });

  const rows = (data ?? []).filter(
    (row) => row.partner_id && row.last_message_id && row.last_sender_id && row.last_created_at,
  );
  const partners = await getUsersByIds(rows.map((row) => row.partner_id!));
  const viewerId = await requireViewerId();

  return rows.flatMap((row) => {
    const partner = partners.get(row.partner_id!);
    if (!partner) return [];
    const fromViewer = row.last_sender_id === viewerId;
    return [
      {
        partner,
        last_message: {
          id: row.last_message_id!,
          sender_id: row.last_sender_id!,
          receiver_id: fromViewer ? partner.id : viewerId,
          content: row.last_content ?? "",
          media_url: row.last_media_url,
          reply_to_id: null,
          created_at: row.last_created_at!,
        },
        unread_count: row.unread_count ?? 0,
        can_reply: row.can_reply ?? false,
      } satisfies ConversationView,
    ];
  });
}

/** Точка на «Чатах» в навигации: все непрочитанные личные сообщения. */
export async function getUnreadDirectTotal(): Promise<number> {
  const supabase = await createClient();
  await requireViewerId();
  const { data } = await supabase.rpc("unread_direct_total");
  return data ?? 0;
}
