/**
 * Единая точка входа для данных.
 *
 * Все экраны импортируют отсюда, а не из `lib/mock` напрямую. Пока
 * `NEXT_PUBLIC_USE_MOCKS` не равен "false", вызовы уходят в моки — ровно
 * так, как работало на этапах 1–3. Когда флаг снят, те же вызовы идут в
 * Supabase.
 *
 * Функции асинхронные в обоих режимах: моки отвечают сразу, но тип обязан
 * совпадать, иначе переключение флага ломало бы компиляцию.
 *
 * Этот модуль серверный: он тянет `lib/supabase/server`, который читает
 * cookies(). Клиентские компоненты получают данные пропсами.
 */

import type {
  Category,
  ChatRole,
  ConversationView,
  DirectMessage,
  FeedTab,
  MessageView,
  ModeratorPermissions,
  Notification,
  ParticipantView,
  PollView,
  PostView,
  SearchFilters,
  University,
  UserView,
} from "@/lib/types";
import * as mock from "@/lib/mock";
import * as dbFeed from "./feed";
import { FEED_MAX, FEED_PAGE } from "./feed";
import * as dbPosts from "./posts";
import * as dbPeople from "./people";
import * as dbDm from "./dm";
import * as dbNotifications from "./notifications";
import * as dbSearch from "./search";
import * as dbReference from "./reference";
import * as dbVerification from "./verification";
import { loadViewer } from "./social";

/** Источник данных. Снять флаг — значит перевести экраны на базу. */
export const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export { CHAT_HISTORY_LIMIT } from "./posts";
export { FEED_MAX, FEED_PAGE } from "./feed";

export { canEnterChat, chatAccessReason, canMessage, canSeeProfile, canSeeInterests } from "@/lib/access";

/* ── зритель ────────────────────────────────────────────────────── */

/** Кто смотрит. На этапе 6 заменяется чтением сессии. */
export async function getViewer(): Promise<UserView> {
  return usingMocks ? mock.currentUser : loadViewer();
}

/* ── справочники ────────────────────────────────────────────────── */

export async function getCategories(): Promise<Category[]> {
  return usingMocks ? mock.categories : dbReference.loadCategories();
}

export async function getMainCategories(): Promise<Category[]> {
  return (await getCategories()).filter((category) => category.is_main);
}

export async function getOtherCategories(): Promise<Category[]> {
  return (await getCategories()).filter((category) => !category.is_main);
}

export async function getUniversities(): Promise<University[]> {
  return usingMocks ? mock.universities : dbReference.loadUniversities();
}

export async function getCategory(id: string): Promise<Category | undefined> {
  return usingMocks ? mock.getCategory(id) : dbReference.getCategory(id);
}

export async function getUniversity(id: string): Promise<University | undefined> {
  return usingMocks ? mock.getUniversity(id) : dbReference.getUniversity(id);
}

export async function getCitiesWithPosts(): Promise<string[]> {
  return usingMocks ? mock.getCitiesWithPosts() : dbReference.getCitiesWithPosts();
}

/* ── лента и идеи ───────────────────────────────────────────────── */

/**
 * Ближайшие `limit` идей ленты и есть ли дальше. Запрашивается на одну
 * больше — так «Показать ещё» появляется, только когда есть что показать.
 */
export async function getFeed(
  tab: FeedTab,
  now: Date,
  limit: number = FEED_PAGE,
): Promise<{ posts: PostView[]; hasMore: boolean }> {
  const take = Math.min(Math.max(1, Math.floor(limit)), FEED_MAX);
  const list = usingMocks
    ? mock.getFeed(tab, now).slice(0, take + 1)
    : await dbFeed.getFeed(tab, now, take + 1);
  return { posts: list.slice(0, take), hasMore: list.length > take };
}

export async function getPost(id: string): Promise<PostView | undefined> {
  return usingMocks ? mock.getPost(id) : dbPosts.getPost(id);
}

export async function getParticipants(postId: string): Promise<ParticipantView[]> {
  return usingMocks ? mock.getParticipants(postId) : dbPosts.getParticipants(postId);
}

export async function getMessages(postId: string): Promise<MessageView[]> {
  return usingMocks ? mock.getMessages(postId) : dbPosts.getMessages(postId);
}

export async function getPinnedMessage(postId: string): Promise<MessageView | undefined> {
  return usingMocks ? mock.getPinnedMessage(postId) : dbPosts.getPinnedMessage(postId);
}

export async function getPolls(postId: string): Promise<PollView[]> {
  return usingMocks ? mock.getPolls(postId) : dbPosts.getPolls(postId);
}

export async function getViewerPermissions(postId: string): Promise<ModeratorPermissions | null> {
  return usingMocks ? mock.getViewerPermissions(postId) : dbPosts.getViewerPermissions(postId);
}

export async function getRole(postId: string, userId: string): Promise<ChatRole> {
  return usingMocks ? mock.getRole(postId, userId) : dbPosts.getRole(postId, userId);
}

export async function getMyIdeaChats(): ReturnType<typeof dbPosts.getMyIdeaChats> {
  return usingMocks ? mock.getMyIdeaChats() : dbPosts.getMyIdeaChats();
}

/* ── люди ───────────────────────────────────────────────────────── */

export async function getUserByNickname(nickname: string): Promise<UserView | undefined> {
  return usingMocks ? mock.getUserByNickname(nickname) : dbPeople.getUserByNickname(nickname);
}

export async function getUserById(id: string): Promise<UserView | undefined> {
  return usingMocks ? mock.getUserById(id) : dbPeople.getUserById(id);
}

/** Несколько профилей одним заходом — для списков, где у каждой строки свой автор. */
export async function getUsersByIds(ids: string[]): Promise<Map<string, UserView>> {
  if (!usingMocks) return dbPeople.getUsersByIds(ids);
  return new Map(
    ids.flatMap((id) => {
      const user = mock.getUserById(id);
      return user ? [[id, user] as const] : [];
    }),
  );
}

export async function getFollowers(userId: string): Promise<UserView[]> {
  return usingMocks ? mock.getFollowers(userId) : dbPeople.getFollowers(userId);
}

export async function getFollowing(userId: string): Promise<UserView[]> {
  return usingMocks ? mock.getFollowing(userId) : dbPeople.getFollowing(userId);
}

export async function getFriends(): Promise<UserView[]> {
  if (usingMocks) return mock.getFriends();
  const viewer = await getViewer();
  return dbPeople.getFriends(viewer.id);
}

export async function getActivePostsByAuthor(authorId: string, now: Date): Promise<PostView[]> {
  return usingMocks
    ? mock.getActivePostsByAuthor(authorId, now)
    : dbPeople.getActivePostsByAuthor(authorId, now);
}

export async function getPastPostsByAuthor(authorId: string, now: Date): Promise<PostView[]> {
  return usingMocks ? mock.getPastPostsByAuthor(authorId, now) : dbPeople.getPastPostsByAuthor(authorId, now);
}

/* ── личные сообщения ───────────────────────────────────────────── */

export async function getConversations(): Promise<ConversationView[]> {
  return usingMocks ? mock.getConversations() : dbDm.getConversations();
}

export async function getThread(partnerId: string): Promise<DirectMessage[]> {
  return usingMocks ? mock.getThread(partnerId) : dbDm.getThread(partnerId);
}

/** Когда собеседник прочитал переписку; в моках «Прочитано» не показывается. */
export async function getPartnerReadAt(partnerId: string): Promise<string | null> {
  return usingMocks ? null : dbDm.getPartnerReadAt(partnerId);
}

/** Кого зритель заблокировал — для экрана «Заблокированные». */
export async function getBlockedUsers(): Promise<UserView[]> {
  return usingMocks ? [] : dbPeople.getBlockedUsers();
}

export async function getUnreadDirectTotal(): Promise<number> {
  return usingMocks ? mock.totalUnreadDirect : dbDm.getUnreadDirectTotal();
}

/* ── уведомления ────────────────────────────────────────────────── */

export async function getNotifications(): Promise<Notification[]> {
  return usingMocks ? mock.getNotifications() : dbNotifications.getNotifications();
}

export async function getUnreadNotificationCount(): Promise<number> {
  return usingMocks ? mock.unreadNotificationCount : dbNotifications.getUnreadNotificationCount();
}

/* ── поиск ──────────────────────────────────────────────────────── */

export async function searchPosts(filters: SearchFilters, now: Date): Promise<PostView[]> {
  return usingMocks ? mock.searchPosts(filters, now) : dbSearch.searchPosts(filters, now);
}

export async function searchUsers(query: string): Promise<UserView[]> {
  return usingMocks ? mock.searchUsers(query) : dbSearch.searchUsers(query);
}

export type { VerificationState } from "./verification";

/** Последняя заявка на проверку личности; в моках заявок нет. */
export async function getLatestVerification(): Promise<dbVerification.VerificationState | null> {
  return usingMocks ? null : dbVerification.getLatestVerification();
}
