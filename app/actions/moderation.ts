"use server";

/** Модераторы идеи. Назначать и менять права может только автор (RLS 0008). */

import { revalidatePath } from "next/cache";
import type { ModeratorPermissions } from "@/lib/types";
import { fail, getActor, notSignedIn, type ActionResult } from "@/lib/actions/actor";

const NO_RIGHTS: ModeratorPermissions = {
  can_post_media: false,
  can_pin: false,
  can_poll: false,
  can_kick: false,
};

export async function setModerator(
  postId: string,
  userId: string,
  makeModerator: boolean,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  if (makeModerator) {
    const { error } = await actor.supabase
      .from("post_moderators")
      .insert({ post_id: postId, user_id: userId, permissions: { ...NO_RIGHTS } });
    if (error) {
      if (error.code === "42501") return { ok: false, error: "Назначать модераторов может только автор." };
      return fail(error);
    }
  } else {
    const { error, count } = await actor.supabase
      .from("post_moderators")
      .delete({ count: "exact" })
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) return fail(error);
    if (!count) return { ok: false, error: "Снимать модераторов может только автор." };
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function updateModeratorPermissions(
  postId: string,
  userId: string,
  permissions: ModeratorPermissions,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  // Только четыре известных ключа — форма jsonb проверяется и в базе (0004).
  const clean: ModeratorPermissions = {
    can_post_media: Boolean(permissions.can_post_media),
    can_pin: Boolean(permissions.can_pin),
    can_poll: Boolean(permissions.can_poll),
    can_kick: Boolean(permissions.can_kick),
  };

  const { error, count } = await actor.supabase
    .from("post_moderators")
    .update({ permissions: { ...clean } }, { count: "exact" })
    .eq("post_id", postId)
    .eq("user_id", userId);

  if (error) return fail(error);
  if (!count) return { ok: false, error: "Менять права модератора может только автор." };

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}
