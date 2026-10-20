/**
 * Социальный контекст зрителя: на кого он подписан, кто подписан на него,
 * в каких идеях он участвует и где модератор.
 *
 * Эти факты одинаковы на весь рендер страницы, поэтому обёрнуты в `cache()`
 * из React: сколько бы экранов и компонентов их ни спросили, запрос уйдёт
 * один раз за запрос. Без этого карточка ленты тянула бы подписки на каждую
 * строку.
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserView } from "@/lib/types";
import { requireViewerId } from "./session";
import { noSocialFacts, toUserView, VIEWER_FIELDS, type SocialFacts, type UserRecord } from "./map";

export interface ViewerEdges {
  viewerId: string;
  /** Кого зритель читает. */
  viewerFollows: ReadonlySet<string>;
  /** Кто читает зрителя. Пересечение с предыдущим — друзья. */
  followsViewer: ReadonlySet<string>;
  /** Кого зритель заблокировал. Кто заблокировал зрителя, ему не видно (0029). */
  blockedByViewer: ReadonlySet<string>;
}

export const loadViewerEdges = cache(async (): Promise<ViewerEdges> => {
  const supabase = await createClient();
  const viewerId = await requireViewerId();

  const [following, followers, blocks] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", viewerId),
    supabase.from("follows").select("follower_id").eq("following_id", viewerId),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", viewerId),
  ]);

  return {
    viewerId,
    viewerFollows: new Set((following.data ?? []).map((row) => row.following_id)),
    followsViewer: new Set((followers.data ?? []).map((row) => row.follower_id)),
    blockedByViewer: new Set((blocks.data ?? []).map((row) => row.blocked_id)),
  };
});

export interface ViewerMemberships {
  /** Идеи, где зритель состоит в чате — автор там тоже есть, его сажает триггер. */
  participantPosts: ReadonlySet<string>;
  /** Идеи, где зритель модератор. */
  moderatorPosts: ReadonlySet<string>;
}

export const loadViewerMemberships = cache(async (): Promise<ViewerMemberships> => {
  const supabase = await createClient();
  const viewerId = await requireViewerId();

  const [participations, moderations] = await Promise.all([
    supabase.from("post_participants").select("post_id").eq("user_id", viewerId),
    supabase.from("post_moderators").select("post_id").eq("user_id", viewerId),
  ]);

  return {
    participantPosts: new Set((participations.data ?? []).map((row) => row.post_id)),
    moderatorPosts: new Set((moderations.data ?? []).map((row) => row.post_id)),
  };
});

/** Профиль самого зрителя. Нужен ленте, чтобы знать его университет. */
export const loadViewer = cache(async (): Promise<UserView> => {
  const supabase = await createClient();
  const viewerId = await requireViewerId();

  const { data, error } = await supabase.from("users").select(VIEWER_FIELDS).eq("id", viewerId).single();

  if (error || !data) {
    throw new Error(`Не удалось загрузить профиль зрителя: ${error?.message ?? "строка не найдена"}`);
  }

  const counts = await loadFollowCounts([viewerId]);
  return toUserView(data as unknown as UserRecord, counts.get(viewerId) ?? noSocialFacts);
});

export type FollowCounts = Map<string, SocialFacts>;

/**
 * Счётчики подписчиков и подписок для набора людей плюс отношение к зрителю.
 * Два запроса по индексам вместо запроса на каждого человека.
 */
export async function loadFollowCounts(userIds: string[]): Promise<FollowCounts> {
  const unique = [...new Set(userIds)];
  const result: FollowCounts = new Map();
  if (unique.length === 0) return result;

  const supabase = await createClient();
  const edges = await loadViewerEdges();

  const [followersOf, followingOf] = await Promise.all([
    supabase.from("follows").select("following_id").in("following_id", unique),
    supabase.from("follows").select("follower_id").in("follower_id", unique),
  ]);

  const followers = new Map<string, number>();
  for (const row of followersOf.data ?? []) {
    followers.set(row.following_id, (followers.get(row.following_id) ?? 0) + 1);
  }

  const following = new Map<string, number>();
  for (const row of followingOf.data ?? []) {
    following.set(row.follower_id, (following.get(row.follower_id) ?? 0) + 1);
  }

  for (const id of unique) {
    result.set(id, {
      follower_count: followers.get(id) ?? 0,
      following_count: following.get(id) ?? 0,
      viewer_follows: edges.viewerFollows.has(id),
      follows_viewer: edges.followsViewer.has(id),
      viewer_blocked: edges.blockedByViewer.has(id),
    });
  }

  return result;
}
