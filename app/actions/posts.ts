"use server";

/** Идея: создать, вступить, выйти или удалить участника, закрыть набор. */

import { revalidatePath } from "next/cache";
import type { ChatAccess, GeoMode, GeoRadius } from "@/lib/types";
import { fail, getActor, notSignedIn, type ActionResult } from "@/lib/actions/actor";

export interface CreatePostInput {
  title: string;
  description: string;
  categoryId: string;
  dateStart: string;
  geoMode: GeoMode;
  geoCity: string;
  geoAddress: string | null;
  geoLat: number | null;
  geoLng: number | null;
  geoRadiusM: GeoRadius | null;
  maxParticipants: number | null;
  chatAccess: ChatAccess;
}

const RADII: readonly number[] = [500, 1000, 2000, 5000, 10000];

/** Те же правила, что CHECK-ограничения в 0004: ошибка до похода в базу. */
function validate(input: CreatePostInput): string | null {
  const title = input.title.trim();
  if (title.length < 3 || title.length > 120) return "Название — от 3 до 120 символов.";
  if (input.description.length > 2000) return "Описание — не больше 2000 символов.";
  if (input.geoCity.trim().length < 2) return "Укажи город.";

  const start = new Date(input.dateStart);
  if (Number.isNaN(start.getTime())) return "Укажи дату и время.";
  if (start.getTime() < Date.now() - 5 * 60_000) return "Время уже прошло — выбери будущее.";

  if (input.geoMode === "radius") {
    if (input.geoRadiusM == null || !RADII.includes(input.geoRadiusM)) return "Выбери радиус.";
  } else if (input.geoRadiusM != null) {
    return "Радиус задаётся только в режиме «Радиус вокруг меня».";
  }
  if (input.geoMode === "area" && !input.geoAddress?.trim()) return "Укажи место встречи.";
  if ((input.geoLat == null) !== (input.geoLng == null)) return "Координаты задаются парой.";

  if (input.maxParticipants != null && (input.maxParticipants < 2 || input.maxParticipants > 500)) {
    return "Участников — от 2 до 500, или без ограничения.";
  }
  return null;
}

export async function createPost(input: CreatePostInput): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const { data: me } = await actor.supabase
    .from("users")
    .select("university_id")
    .eq("id", actor.viewerId)
    .single();
  if (!me) return notSignedIn;

  const { data, error } = await actor.supabase
    .from("posts")
    .insert({
      author_id: actor.viewerId,
      title: input.title.trim(),
      description: input.description.trim(),
      category_id: input.categoryId,
      date_start: new Date(input.dateStart).toISOString(),
      geo_mode: input.geoMode,
      geo_city: input.geoCity.trim(),
      geo_address: input.geoAddress?.trim() || null,
      geo_lat: input.geoLat,
      geo_lng: input.geoLng,
      geo_radius_m: input.geoRadiusM,
      max_participants: input.maxParticipants,
      chat_access: input.chatAccess,
      // Триггер posts_set_university всё равно возьмёт вуз из профиля автора.
      university_id: me.university_id,
    })
    .select("id")
    .single();

  if (error || !data) return fail(error);

  revalidatePath("/");
  return { ok: true, data: { id: data.id } };
}

export async function joinPost(postId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  // RLS пропустит вставку, только если can_join_post: доступ к чату,
  // набор открыт и есть свободное место.
  const { error } = await actor.supabase
    .from("post_participants")
    .insert({ post_id: postId, user_id: actor.viewerId });

  if (error) {
    if (error.code === "42501") {
      return { ok: false, error: "Присоединиться нельзя: набор закрыт, мест нет или чат только для своих." };
    }
    return fail(error);
  }
  revalidatePath(`/post/${postId}`);
  revalidatePath("/messages");
  return { ok: true };
}

/** Выйти самому или удалить участника (автор и модератор с can_kick). */
export async function removeParticipant(postId: string, userId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  const { error, count } = await actor.supabase
    .from("post_participants")
    .delete({ count: "exact" })
    .eq("post_id", postId)
    .eq("user_id", userId);

  if (error) return fail(error);
  // RLS не бросает ошибку на запрещённое удаление — просто удаляет ноль строк.
  if (!count) return { ok: false, error: "На это нет прав." };

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function closePost(postId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  const { error, count } = await actor.supabase
    .from("posts")
    .update({ is_closed: true }, { count: "exact" })
    .eq("id", postId);

  if (error) return fail(error);
  if (!count) return { ok: false, error: "Закрыть набор может только автор." };

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}
