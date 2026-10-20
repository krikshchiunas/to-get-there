/** Уведомления зрителя. */

import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";
import { toNotificationPayload } from "./map";
import { requireViewerId } from "./session";

/**
 * Последние уведомления. Старые прочитанные база удаляет сама через 90 дней
 * (0034), а показывать на одном экране больше сотни незачем.
 */
export const NOTIFICATIONS_LIMIT = 100;

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", await requireViewerId())
    .order("created_at", { ascending: false })
    .limit(NOTIFICATIONS_LIMIT);

  return (data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    payload: toNotificationPayload(row.payload),
    is_read: row.is_read,
    created_at: row.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", await requireViewerId())
    .eq("is_read", false);
  return count ?? 0;
}
