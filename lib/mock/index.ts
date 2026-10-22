/**
 * The mock data layer — the only thing the UI reads during stages 1–3.
 *
 * Every function here has the signature the Supabase-backed version will
 * have, so wiring the real backend means replacing the body, not the call
 * sites. Reads that depend on the clock take `now` explicitly.
 */

import {
  isFriend,
  type Category,
  type ConversationView,
  type DirectMessage,
  type FeedTab,
  type MessageView,
  type ModeratorPermissions,
  type Notification,
  type ParticipantView,
  type PollView,
  type PostView,
  type SearchFilters,
  type University,
  type UserView,
} from "@/lib/types";
import { distanceMetres, isInFeed, minutesOfDay } from "@/lib/format";
import { categories, categoryById, mainCategories, otherCategories } from "./categories";
import { universities, universityById } from "./universities";
import { currentUser, userById, userByNickname, users } from "./users";
import { postById, posts } from "./posts";
import { messagesOf, participantsOf, permissionsOf, pollsOf, postIdsForViewer, roleOf } from "./chat";
import { canMessage, conversations, threadWith, totalUnreadDirect } from "./dms";
import { notifications, unreadNotificationCount } from "./notifications";

export { currentUser, users, posts, categories, universities };
export { canMessage, totalUnreadDirect, unreadNotificationCount };
export { mainCategories, otherCategories };

/** Where the viewer is standing, for the "radius around me" filter. */
export const viewerLocation = { lat: 52.5106, lng: 13.3274, label: "TU Berlin, Charlottenburg" };

/* ── reference data ─────────────────────────────────────────────── */

export function getCategory(id: string): Category | undefined {
  return categoryById.get(id);
}

export function getUniversity(id: string): University | undefined {
  return universityById.get(id);
}

/* ── feed ───────────────────────────────────────────────────────── */

/**
 * Chronological: the next departure first. A post drops out once the author
 * closes sign-up or an hour after it starts — the chat stays reachable from
 * the chat list and from the author's profile.
 */
function chronological(list: PostView[]): PostView[] {
  return [...list].sort((a, b) => a.date_start.localeCompare(b.date_start));
}

export function getFeed(tab: FeedTab, now: Date): PostView[] {
  const live = posts.filter((post) => isInFeed(post, now));

  if (tab === "following") {
    return chronological(
      live.filter((post) => post.author.viewer_follows && post.author_id !== currentUser.id),
    );
  }

  return chronological(live.filter((post) => post.university_id === currentUser.university_id));
}

/* ── posts ──────────────────────────────────────────────────────── */

export function getPost(id: string): PostView | undefined {
  return postById.get(id);
}

/** Ideas a user is hosting that are still open. Shown on their profile. */
export function getActivePostsByAuthor(authorId: string, now: Date): PostView[] {
  return chronological(posts.filter((p) => p.author_id === authorId && isInFeed(p, now)));
}

/** Ideas that already happened or were closed, newest first. */
export function getPastPostsByAuthor(authorId: string, now: Date): PostView[] {
  return posts
    .filter((p) => p.author_id === authorId && !isInFeed(p, now))
    .sort((a, b) => b.date_start.localeCompare(a.date_start));
}

/** Who may enter the group chat, per the author's access setting. */
export function canEnterChat(post: PostView): boolean {
  if (post.viewer_role !== "guest") return true;
  switch (post.chat_access) {
    case "everyone":
      return true;
    case "followers":
      return post.author.viewer_follows;
    case "friends":
      return isFriend(post.author);
  }
}

export function chatAccessReason(post: PostView): string | null {
  if (canEnterChat(post)) return null;
  return post.chat_access === "followers"
    ? `Зайти в чат могут только подписчики ${post.author.nickname}.`
    : `Зайти в чат могут только друзья ${post.author.nickname}.`;
}

/* ── idea chat ──────────────────────────────────────────────────── */

export function getParticipants(postId: string): ParticipantView[] {
  return participantsOf(postId);
}

export function getMessages(postId: string): MessageView[] {
  return messagesOf(postId);
}

export function getPinnedMessage(postId: string): MessageView | undefined {
  return messagesOf(postId).find((m) => m.is_pinned);
}

export function getPolls(postId: string): PollView[] {
  return pollsOf(postId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getViewerPermissions(postId: string): ModeratorPermissions | null {
  return permissionsOf(postId, currentUser.id);
}

export function getRole(postId: string, userId: string) {
  return roleOf(postId, userId);
}

/** The chat list: idea chats the viewer belongs to, latest activity first. */
export function getMyIdeaChats(): Array<{
  post: PostView;
  last_message: MessageView | undefined;
  participant_count: number;
}> {
  return postIdsForViewer(currentUser.id)
    .map((postId) => {
      const post = postById.get(postId);
      if (!post) return null;
      const messages = messagesOf(postId);
      return {
        post,
        last_message: messages[messages.length - 1],
        participant_count: participantsOf(postId).length,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => {
      const left = a.last_message?.created_at ?? a.post.created_at;
      const right = b.last_message?.created_at ?? b.post.created_at;
      return right.localeCompare(left);
    });
}

/* ── profiles ───────────────────────────────────────────────────── */

export function getUserByNickname(nickname: string): UserView | undefined {
  return userByNickname.get(nickname);
}

export function getUserById(id: string): UserView | undefined {
  return userById.get(id);
}

function audienceAllows(audience: "everyone" | "university" | "friends", user: UserView): boolean {
  if (user.id === currentUser.id) return true;
  switch (audience) {
    case "everyone":
      return true;
    case "university":
      return user.university_id === currentUser.university_id;
    case "friends":
      return isFriend(user);
  }
}

export function canSeeProfile(user: UserView): boolean {
  return audienceAllows(user.privacy_settings.who_can_see_profile, user);
}

export function canSeeInterests(user: UserView): boolean {
  return audienceAllows(user.privacy_settings.who_can_see_interests, user);
}

/**
 * Mock follow graph. Only the viewer's own edges are modelled properly;
 * other users get a stable sample so the profile counters have faces.
 */
export function getFollowers(userId: string): UserView[] {
  if (userId === currentUser.id) return users.filter((u) => u.follows_viewer);
  return users.filter((u) => u.id !== userId).slice(0, 6);
}

export function getFollowing(userId: string): UserView[] {
  if (userId === currentUser.id) return users.filter((u) => u.viewer_follows);
  return users.filter((u) => u.id !== userId).slice(3, 8);
}

/** Mutual follows. The "friends" tier in every privacy setting. */
export function getFriends(): UserView[] {
  return users.filter((u) => isFriend(u));
}

/* ── direct messages ────────────────────────────────────────────── */

export function getConversations(): ConversationView[] {
  return conversations();
}

export function getThread(partnerId: string): DirectMessage[] {
  return threadWith(partnerId);
}

/* ── notifications ──────────────────────────────────────────────── */

export function getNotifications(): Notification[] {
  return [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/* ── search ─────────────────────────────────────────────────────── */

export function searchPosts(filters: SearchFilters, now: Date): PostView[] {
  const needle = filters.query.trim().toLowerCase();

  const matched = posts.filter((post) => {
    if (!isInFeed(post, now)) return false;

    if (needle) {
      const haystack = [
        post.title,
        post.description,
        post.geo_city,
        post.geo_address ?? "",
        post.category.name,
        post.author.nickname,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (filters.category_ids.length && !filters.category_ids.includes(post.category_id)) {
      return false;
    }

    const day = post.date_start.slice(0, 10);
    if (filters.date_from && day < filters.date_from) return false;
    if (filters.date_to && day > filters.date_to) return false;

    if (filters.time_window) {
      const minutes = minutesOfDay(post.date_start);
      const { from_minutes, to_minutes } = filters.time_window;
      if (minutes < from_minutes || minutes > to_minutes) return false;
    }

    if (filters.geo_mode === "city" && filters.geo_city) {
      if (post.geo_city.toLowerCase() !== filters.geo_city.trim().toLowerCase()) return false;
    }

    if (filters.geo_mode === "radius" && filters.geo_radius_m) {
      if (post.geo_lat == null || post.geo_lng == null) return false;
      const metres = distanceMetres(viewerLocation, { lat: post.geo_lat, lng: post.geo_lng });
      if (metres > filters.geo_radius_m) return false;
    }

    return true;
  });

  return chronological(matched);
}

/** People search honours `visible_in_search`. */
export function searchUsers(query: string): UserView[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return users.filter((user) => {
    if (!user.privacy_settings.visible_in_search) return false;
    if (user.id === currentUser.id) return false;
    return [user.nickname, user.faculty ?? "", user.university?.short_name ?? "", ...user.interests]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

/** Cities that currently have ideas, for the city picker. */
export function getCitiesWithPosts(): string[] {
  return [...new Set(posts.map((p) => p.geo_city))].sort((a, b) => a.localeCompare(b, "de"));
}
