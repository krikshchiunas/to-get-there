"use server";

/** Подписки. Взаимная подписка — это и есть дружба, отдельно не хранится. */

import { revalidatePath } from "next/cache";
import { fail, getActor, notSignedIn, type ActionResult } from "@/lib/actions/actor";

export async function setFollow(targetId: string, follow: boolean): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;
  if (targetId === actor.viewerId) return { ok: false, error: "На себя подписаться нельзя." };

  if (follow) {
    const { error } = await actor.supabase
      .from("follows")
      .insert({ follower_id: actor.viewerId, following_id: targetId });
    // Повторная подписка — не ошибка для человека: он уже подписан.
    if (error && error.code !== "23505") return fail(error);
  } else {
    const { error } = await actor.supabase
      .from("follows")
      .delete()
      .eq("follower_id", actor.viewerId)
      .eq("following_id", targetId);
    if (error) return fail(error);
  }

  revalidatePath("/u/[nickname]", "page");
  revalidatePath("/");
  return { ok: true };
}
