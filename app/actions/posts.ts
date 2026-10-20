"use server";

/** Идея: создать, удалить, вступить, выйти или удалить участника, закрыть набор. */

import { isValidCoord, roundCoord, STORED_DIGITS } from "@/lib/place";
import { revalidatePath } from "next/cache";
import { CHAT_MEDIA_BUCKET } from "@/lib/media";
import type { ChatAccess, GeoMode, GeoRadius } from "@/lib/types";
import { fail, getActor, noActor, notSignedIn, type ActionResult } from "@/lib/actions/actor";
import { areUuids, invalidInput, isUuid, oneOf, text } from "@/lib/validate";

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
const GEO_MODES = ["radius", "area", "city"] as const;
const CHAT_ACCESS = ["everyone", "followers", "friends"] as const;

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Аргумент пришёл из сети: приводим к форме CreatePostInput, а что не
 * приводится — отбрасываем. null — форма не распознана вовсе.
 */
function normalize(raw: unknown): CreatePostInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const input = raw as Record<string, unknown>;
  const geoMode = oneOf(input.geoMode, GEO_MODES);
  const chatAccess = oneOf(input.chatAccess, CHAT_ACCESS);
  if (!geoMode || !chatAccess || !isUuid(input.categoryId) || typeof input.dateStart !== "string")
    return null;
  const radius = finiteOrNull(input.geoRadiusM);
  const max = finiteOrNull(input.maxParticipants);
  return {
    title: text(input.title),
    description: typeof input.description === "string" ? input.description : "",
    categoryId: input.categoryId,
    dateStart: input.dateStart,
    geoMode,
    geoCity: text(input.geoCity),
    geoAddress: text(input.geoAddress) || null,
    geoLat: finiteOrNull(input.geoLat),
    geoLng: finiteOrNull(input.geoLng),
    geoRadiusM: radius as GeoRadius | null,
    maxParticipants: max === null ? null : Math.trunc(max),
    chatAccess,
  };
}

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
  if (input.geoMode === "area" && !input.geoAddress?.trim()) return "Опиши, как найти друг друга на месте.";
  if ((input.geoLat == null) !== (input.geoLng == null)) return "Координаты задаются парой.";
  if (input.geoLat != null && !isValidCoord(input.geoLat, input.geoLng))
    return "Точка на карте не распознана.";
  if (input.geoMode !== "city" && input.geoLat == null) return "Отметь место на карте.";

  if (input.maxParticipants != null && (input.maxParticipants < 2 || input.maxParticipants > 500)) {
    return "Участников — от 2 до 500, или без ограничения.";
  }
  return null;
}

/**
 * Сколько точности оставить. Идею видят все вошедшие, поэтому в режиме
 * радиуса точка — около километра: для поиска «рядом» хватает, а где
 * автор живёт, по ней не понять. Область автор показал сам — до ~10 м.
 * В режиме города точки нет вовсе.
 */
function storedPoint(input: CreatePostInput): { geo_lat: number | null; geo_lng: number | null } {
  if (input.geoMode === "city" || input.geoLat == null || input.geoLng == null) {
    return { geo_lat: null, geo_lng: null };
  }
  const digits = STORED_DIGITS[input.geoMode];
  return { geo_lat: roundCoord(input.geoLat, digits), geo_lng: roundCoord(input.geoLng, digits) };
}

export async function createPost(raw: CreatePostInput): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return noActor();

  const input = normalize(raw);
  if (!input) return invalidInput;
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
      ...storedPoint(input),
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

/**
 * Править идею может только автор (posts_update_author, 0008). База сама
 * не даст поставить мест меньше, чем уже вступило, и сообщит участникам,
 * если поменялись время или место (0037).
 */
export async function updatePost(postId: string, raw: CreatePostInput): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!isUuid(postId)) return invalidInput;

  const input = normalize(raw);
  if (!input) return invalidInput;
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const { error, count } = await actor.supabase
    .from("posts")
    .update(
      {
        title: input.title.trim(),
        description: input.description.trim(),
        category_id: input.categoryId,
        date_start: new Date(input.dateStart).toISOString(),
        geo_mode: input.geoMode,
        geo_city: input.geoCity.trim(),
        geo_address: input.geoAddress?.trim() || null,
        ...storedPoint(input),
        geo_radius_m: input.geoRadiusM,
        max_participants: input.maxParticipants,
        chat_access: input.chatAccess,
      },
      { count: "exact" },
    )
    .eq("id", postId);

  if (error) {
    if (error.code === "23514" && error.hint === "capacity_below_joined") {
      return { ok: false, error: "Участников уже больше — мест не может стать меньше, чем вступило." };
    }
    return fail(error);
  }
  if (!count) return { ok: false, error: "Править идею может только её автор." };

  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function joinPost(postId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!isUuid(postId)) return invalidInput;

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
  if (!actor) return noActor();
  if (!areUuids(postId, userId)) return invalidInput;

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
  if (!actor) return noActor();
  if (!isUuid(postId)) return invalidInput;

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

/**
 * Удалить идею целиком: чат, голосования, участников. Каскады в базе уносят
 * строки, а фото из чата лежат в Storage, куда каскад не дотягивается, —
 * их приложение удаляет само, пока идея ещё существует и политика
 * post_media_delete_own_or_author признаёт в зрителе автора.
 */
export async function deletePost(postId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!isUuid(postId)) return invalidInput;

  const { data: post } = await actor.supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.author_id !== actor.viewerId)
    return { ok: false, error: "Удалить идею может только её автор." };

  const bucket = actor.supabase.storage.from(CHAT_MEDIA_BUCKET);
  const { data: files } = await bucket.list(postId, { limit: 1000 });
  const paths = (files ?? []).map((file) => `${postId}/${file.name}`);
  if (paths.length > 0) await bucket.remove(paths);

  const { error, count } = await actor.supabase.from("posts").delete({ count: "exact" }).eq("id", postId);
  if (error) return fail(error);
  if (!count) return { ok: false, error: "Удалить идею может только её автор." };

  revalidatePath("/", "layout");
  return { ok: true };
}
