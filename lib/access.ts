/**
 * Правила доступа — чистые функции над уже загруженными объектами.
 *
 * Те же правила стоят в базе (`can_see_profile`, `can_enter_post_chat`,
 * `can_message_user` в миграции 0007) и там они и решают: RLS не отдаст
 * строку, которую видеть нельзя. Здесь они нужны, чтобы экран показал
 * внятную причину вместо пустоты.
 *
 * Зритель передаётся аргументом, а не берётся из модуля: этот файл
 * импортируется и на сервере, и в браузере.
 */

import type { PostView, ProfileAudience, UserView } from "./types";
import { isFriend } from "./types";

function audienceAllows(audience: ProfileAudience, user: UserView, viewer: UserView): boolean {
  if (user.id === viewer.id) return true;
  switch (audience) {
    case "everyone":
      return true;
    case "university":
      return user.university_id === viewer.university_id;
    case "friends":
      return isFriend(user);
  }
}

export function canSeeProfile(user: UserView, viewer: UserView): boolean {
  return audienceAllows(user.privacy_settings.who_can_see_profile, user, viewer);
}

export function canSeeInterests(user: UserView, viewer: UserView): boolean {
  return audienceAllows(user.privacy_settings.who_can_see_interests, user, viewer);
}

/** Повторяет privacy_settings.who_can_message получателя. */
export function canMessage(partner: UserView, viewer?: UserView): boolean {
  if (viewer && partner.id === viewer.id) return false;
  // Заблокировал сам — писать нельзя (0029). Обратное зритель не видит:
  // заблокировавший его просто не находится.
  if (partner.viewer_blocked) return false;
  switch (partner.privacy_settings.who_can_message) {
    case "everyone":
      return true;
    case "friends":
      return isFriend(partner);
    case "nobody":
      return false;
  }
}

/** Кто может зайти в групповой чат идеи. */
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
