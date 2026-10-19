/** Уведомления зрителя. */

import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";
import { toNotificationPayload } from "./map";
import { getViewerId } from "./session";

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", getViewerId())
    .order("created_at", { ascending: false });

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
    .eq("user_id", getViewerId())
    .eq("is_read", false);
  return count ?? 0;
}
