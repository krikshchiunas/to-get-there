"use server";

import { revalidatePath } from "next/cache";
import { fail, getActor, noActor, type ActionResult } from "@/lib/actions/actor";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();

  const { error } = await actor.supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", actor.viewerId);

  if (error) return fail(error);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();

  const { error } = await actor.supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", actor.viewerId)
    .eq("is_read", false);

  if (error) return fail(error);
  revalidatePath("/notifications");
  revalidatePath("/");
  return { ok: true };
}
