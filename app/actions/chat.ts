"use server";

/** Групповой чат идеи: сообщения, закрепление, голосования. */

import { revalidatePath } from "next/cache";
import { fail, getActor, notSignedIn, type ActionResult } from "@/lib/actions/actor";

const MAX_MESSAGE = 2000;

export async function sendMessage(
  postId: string,
  content: string,
  mediaUrl: string | null = null,
): Promise<ActionResult<{ id: string; created_at: string }>> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  const text = content.trim();
  if (!text && !mediaUrl) return { ok: false, error: "Пустое сообщение не отправить." };
  if (text.length > MAX_MESSAGE) return { ok: false, error: `Сообщение — не больше ${MAX_MESSAGE} символов.` };

  // RLS: автор — сам зритель, он участник чата, а медиа — только с can_post_media.
  const { data, error } = await actor.supabase
    .from("messages")
    .insert({ post_id: postId, author_id: actor.viewerId, content: text, media_url: mediaUrl })
    .select("id, created_at")
    .single();

  if (error || !data) {
    if (error?.code === "42501") {
      return {
        ok: false,
        error: mediaUrl ? "Отправлять фото и видео могут только модераторы с этим правом." : "Писать могут только участники чата.",
      };
    }
    return fail(error);
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true, data };
}

export async function setPinned(postId: string, messageId: string, pinned: boolean): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

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
  if (!actor) return notSignedIn;

  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 5) {
    return { ok: false, error: "Такого варианта нет." };
  }

  // Один голос на человека: повторный голос меняет вариант. Триггер
  // poll_votes_check_option не даст указать на несуществующий вариант.
  const { error } = await actor.supabase
    .from("poll_votes")
    .upsert(
      { poll_id: pollId, user_id: actor.viewerId, option_index: optionIndex },
      { onConflict: "poll_id,user_id" },
    );

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
  if (!actor) return notSignedIn;

  const q = question.trim();
  const opts = options.map((option) => option.trim()).filter(Boolean);
  if (q.length < 3 || q.length > 140) return { ok: false, error: "Вопрос — от 3 до 140 символов." };
  if (opts.length < 2 || opts.length > 6) return { ok: false, error: "Вариантов — от 2 до 6." };
  if (opts.some((option) => option.length > 60)) return { ok: false, error: "Вариант — не длиннее 60 символов." };

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
    if (error?.code === "42501") return { ok: false, error: "Создавать голосования могут автор и модераторы с этим правом." };
    return fail(error);
  }
  revalidatePath(`/post/${postId}`);
  return { ok: true, data: { id: data.id } };
}
