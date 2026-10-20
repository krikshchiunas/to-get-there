"use server";

/** Групповой чат идеи: сообщения, ответы, удаление, закрепление, голосования. */

import { revalidatePath } from "next/cache";
import { fail, getActor, noActor, type ActionResult } from "@/lib/actions/actor";
import { CHAT_MEDIA_BUCKET, isChatMediaPath } from "@/lib/media";
import { areUuids, invalidInput, isUuid, optionalUuid } from "@/lib/validate";

const MAX_MESSAGE = 2000;

export async function sendMessage(
  postId: string,
  content: string,
  mediaUrl: string | null = null,
  replyToId: string | null = null,
): Promise<ActionResult<{ id: string; created_at: string }>> {
  const actor = await getActor();
  if (!actor) return noActor();

  const reply = optionalUuid(replyToId);
  if (!isUuid(postId) || typeof content !== "string" || !reply.ok) return invalidInput;
  if (mediaUrl !== null && typeof mediaUrl !== "string") return invalidInput;

  const text = content.trim();
  if (!text && !mediaUrl) return { ok: false, error: "Пустое сообщение не отправить." };
  if (text.length > MAX_MESSAGE)
    return { ok: false, error: `Сообщение — не больше ${MAX_MESSAGE} символов.` };
  // Только файл из папки этой идеи: ни внешней ссылки, ни фото из чужого чата.
  if (mediaUrl !== null && !isChatMediaPath(mediaUrl, postId)) {
    return { ok: false, error: "Фото должно быть загружено через приложение." };
  }

  // RLS: автор — сам зритель, он участник чата, а медиа — только с can_post_media.
  const { data, error } = await actor.supabase
    .from("messages")
    .insert({
      post_id: postId,
      author_id: actor.viewerId,
      content: text,
      media_url: mediaUrl,
      reply_to_id: reply.value,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    if (error?.code === "42501") {
      return {
        ok: false,
        error: mediaUrl
          ? "Отправлять фото могут только автор и модераторы с этим правом."
          : "Писать могут только участники чата.",
      };
    }
    return fail(error);
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true, data };
}

/**
 * Удалить сообщение: своё — всегда, чужое — автору идеи (политика
 * messages_delete_own_or_author). Фото из сообщения удаляется из Storage
 * тем же правом. Ответы на него остаются, ссылка на исходное обнуляется.
 */
export async function deleteMessage(postId: string, messageId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!areUuids(postId, messageId)) return invalidInput;

  const { data: message } = await actor.supabase
    .from("messages")
    .select("media_url")
    .eq("id", messageId)
    .eq("post_id", postId)
    .maybeSingle();

  const { error, count } = await actor.supabase
    .from("messages")
    .delete({ count: "exact" })
    .eq("id", messageId)
    .eq("post_id", postId);

  if (error) return fail(error);
  if (!count) return { ok: false, error: "Удалить можно своё сообщение, а автору идеи — любое." };

  if (message?.media_url && isChatMediaPath(message.media_url, postId)) {
    await actor.supabase.storage.from(CHAT_MEDIA_BUCKET).remove([message.media_url]);
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function setPinned(postId: string, messageId: string, pinned: boolean): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!areUuids(postId, messageId) || typeof pinned !== "boolean") return invalidInput;

  // Триггер messages_single_pin сам снимет прежнее закрепление.
  const { error, count } = await actor.supabase
    .from("messages")
    .update({ is_pinned: pinned }, { count: "exact" })
    .eq("id", messageId)
    .eq("post_id", postId);

  if (error) return fail(error);
  if (!count) return { ok: false, error: "Закреплять могут автор и модераторы с этим правом." };

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function vote(postId: string, pollId: string, optionIndex: number): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!areUuids(postId, pollId)) return invalidInput;

  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 5) {
    return { ok: false, error: "Такого варианта нет." };
  }

  // Один голос на человека: повторный голос меняет вариант. Не upsert —
  // он обновил бы и poll_id/user_id, а на них нет прав (см. 0015).
  // Триггер poll_votes_check_option не даст указать на несуществующий вариант.
  const { error } = await actor.supabase.rpc("cast_vote", { poll: pollId, option_index: optionIndex });

  if (error) {
    if (error.code === "42501") return { ok: false, error: "Голосовать могут только участники чата." };
    return fail(error);
  }
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function createPoll(
  postId: string,
  question: string,
  options: string[],
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return noActor();
  if (!isUuid(postId) || typeof question !== "string" || !Array.isArray(options)) return invalidInput;
  if (options.some((option) => typeof option !== "string")) return invalidInput;

  const q = question.trim();
  const opts = options.map((option) => option.trim()).filter(Boolean);
  if (q.length < 3 || q.length > 140) return { ok: false, error: "Вопрос — от 3 до 140 символов." };
  if (opts.length < 2 || opts.length > 6) return { ok: false, error: "Вариантов — от 2 до 6." };
  if (opts.some((option) => option.length > 60))
    return { ok: false, error: "Вариант — не длиннее 60 символов." };

  const { data, error } = await actor.supabase
    .from("polls")
    .insert({
      post_id: postId,
      created_by: actor.viewerId,
      question: q,
      options: opts.map((label) => ({ label })),
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "42501")
      return { ok: false, error: "Создавать голосования могут автор и модераторы с этим правом." };
    return fail(error);
  }
  revalidatePath(`/post/${postId}`);
  return { ok: true, data: { id: data.id } };
}
