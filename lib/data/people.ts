/** Профили, подписки и идеи конкретного человека. */

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { isInFeed } from "@/lib/format";
import type { PostView, UserView } from "@/lib/types";
import { noSocialFacts, toUserView } from "./map";
import { loadFollowCounts } from "./social";
import { POST_SELECT, toPostViews, type PostRow } from "./feed";

type UserWithUniversity = Tables<"users"> & { university: Tables<"universities"> | null };

const USER_SELECT = "*,university:universities(*)";

/** Превращает строки `users` в `UserView`, добрав счётчики одним заходом. */
export async function toUserViews(rows: UserWithUniversity[]): Promise<UserView[]> {
  if (rows.length === 0) return [];
  const counts = await loadFollowCounts(rows.map((row) => row.id));
  return rows.flatMap((row) =>
    row.university ? [toUserView(row, counts.get(row.id) ?? noSocialFacts)] : [],
  );
}

export async function getUserByNickname(nickname: string): Promise<UserView | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select(USER_SELECT).eq("nickname", nickname).maybeSingle();
  if (!data) return undefined;
  const [view] = await toUserViews([data as unknown as UserWithUniversity]);
  return view;
}

export async function getUserById(id: string): Promise<UserView | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select(USER_SELECT).eq("id", id).maybeSingle();
  if (!data) return undefined;
  const [view] = await toUserViews([data as unknown as UserWithUniversity]);
  return view;
}

/** Несколько профилей одним запросом; кого RLS не показывает — того нет. */
export async function getUsersByIds(ids: string[]): Promise<Map<string, UserView>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("users").select(USER_SELECT).in("id", unique);
  const views = await toUserViews((data ?? []) as unknown as UserWithUniversity[]);
  return new Map(views.map((view) => [view.id, view]));
}

export async function getFollowers(userId: string): Promise<UserView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select(`follower:users!follows_follower_id_fkey(${USER_SELECT})`)
    .eq("following_id", userId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []).flatMap((row) => {
    const follower = (row as unknown as { follower: UserWithUniversity | null }).follower;
    return follower ? [follower] : [];
  });
  return toUserViews(rows);
}

export async function getFollowing(userId: string): Promise<UserView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select(`following:users!follows_following_id_fkey(${USER_SELECT})`)
    .eq("follower_id", userId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []).flatMap((row) => {
    const following = (row as unknown as { following: UserWithUniversity | null }).following;
    return following ? [following] : [];
  });
  return toUserViews(rows);
}

/** Друзья — взаимная подписка, то есть пересечение двух списков. */
export async function getFriends(viewerId: string): Promise<UserView[]> {
  const [following, followers] = await Promise.all([getFollowing(viewerId), getFollowers(viewerId)]);
  const followerIds = new Set(followers.map((user) => user.id));
  return following.filter((user) => followerIds.has(user.id));
}

async function postsByAuthor(authorId: string): Promise<PostView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("author_id", authorId)
    .order("date_start", { ascending: true });
  if (error) throw new Error(`Идеи автора не загрузились: ${error.message}`);
  return toPostViews((data ?? []) as unknown as PostRow[]);
}

export async function getActivePostsByAuthor(authorId: string, now: Date): Promise<PostView[]> {
  return (await postsByAuthor(authorId)).filter((post) => isInFeed(post, now));
}

export async function getPastPostsByAuthor(authorId: string, now: Date): Promise<PostView[]> {
  return (await postsByAuthor(authorId))
    .filter((post) => !isInFeed(post, now))
    .sort((a, b) => b.date_start.localeCompare(a.date_start));
}

/** Заблокированные зрителем, последние сверху. Их профили зрителю видны (0029). */
export async function getBlockedUsers(): Promise<UserView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_blocks")
    .select(`blocked:users!user_blocks_blocked_id_fkey(${USER_SELECT})`)
    .order("created_at", { ascending: false });

  const rows = (data ?? []).flatMap((row) => {
    const blocked = (row as unknown as { blocked: UserWithUniversity | null }).blocked;
    return blocked ? [blocked] : [];
  });
  return toUserViews(rows);
}
