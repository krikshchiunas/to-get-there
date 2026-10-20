"use server";

/**
 * Аккаунт целиком: удаление (DSGVO ст. 17). Выгрузка данных — маршрут
 * app/api/account/export, потому что она отдаёт файл.
 */

import { redirect } from "next/navigation";
import { fail, getActor, noActor, type ActionResult } from "@/lib/actions/actor";
import { AVATAR_BUCKET, CHAT_MEDIA_BUCKET } from "@/lib/media";
import { text } from "@/lib/validate";

/** Storage удаляет не больше тысячи путей за раз. */
const REMOVE_BATCH = 1000;

/**
 * Удаляет аккаунт и всё, что с ним связано.
 *
 * Порядок важен. Сначала файлы: SQL их удалить не может, а после удаления
 * строки пользователя политики Storage уже не признают в нём владельца.
 * Потом delete_my_account() — каскады уносят профиль, идеи, сообщения,
 * подписки. Последним — выход, чтобы в браузере не осталось сессии.
 *
 * Подтверждение — ник, набранный руками: случайным нажатием аккаунт не
 * удалить.
 */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return noActor();

  const { data: me } = await actor.supabase
    .from("users")
    .select("nickname")
    .eq("id", actor.viewerId)
    .single();
  if (!me) return noActor();
  if (text(confirmation).toLowerCase() !== me.nickname) {
    return { ok: false, error: "Ник не совпал. Набери его точно так, как в профиле." };
  }

  const paths = await collectFiles(actor);
  for (const [bucket, list] of paths) {
    for (let start = 0; start < list.length; start += REMOVE_BATCH) {
      await actor.supabase.storage.from(bucket).remove(list.slice(start, start + REMOVE_BATCH));
    }
  }

  const { error } = await actor.supabase.rpc("delete_my_account");
  if (error) return fail(error);

  await actor.supabase.auth.signOut();
  redirect("/auth/login?deleted=1");
}

type Actor = NonNullable<Awaited<ReturnType<typeof getActor>>>;

/** Все файлы человека: аватары, фото в чатах его идей и его фото в чужих чатах. */
async function collectFiles(actor: Actor): Promise<Map<string, string[]>> {
  const { supabase, viewerId } = actor;

  const [avatars, ownPosts, ownMedia] = await Promise.all([
    supabase.storage.from(AVATAR_BUCKET).list(viewerId, { limit: REMOVE_BATCH }),
    supabase.from("posts").select("id").eq("author_id", viewerId),
    supabase.from("messages").select("media_url").eq("author_id", viewerId).not("media_url", "is", null),
  ]);

  const chatFiles = new Set<string>();
  for (const row of ownMedia.data ?? []) if (row.media_url) chatFiles.add(row.media_url);

  // Фото других людей в чатах его идей: идея уходит, и они вместе с ней.
  const listings = await Promise.all(
    (ownPosts.data ?? []).map((post) =>
      supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .list(post.id, { limit: REMOVE_BATCH })
        .then((result) => (result.data ?? []).map((file) => `${post.id}/${file.name}`)),
    ),
  );
  for (const list of listings) for (const path of list) chatFiles.add(path);

  return new Map([
    [AVATAR_BUCKET, (avatars.data ?? []).map((file) => `${viewerId}/${file.name}`)],
    [CHAT_MEDIA_BUCKET, [...chatFiles]],
  ]);
}
