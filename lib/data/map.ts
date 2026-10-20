/**
 * Строки Postgres → типы домена из lib/types.ts.
 *
 * Типы колонок совпадают с типами домена всюду, кроме jsonb: база отдаёт их
 * как `Json`, а приложение ждёт конкретную форму. Форма гарантирована
 * ограничениями CHECK в миграциях 0003 и 0004, но TypeScript об этом не
 * знает, поэтому разбор идёт через функции ниже — со значениями по
 * умолчанию, чтобы кривая строка роняла одно поле, а не весь экран.
 */

import type { Json, Tables } from "@/lib/database.types";
import type {
  Category,
  ChatRole,
  ModeratorPermissions,
  NotificationPayload,
  NotificationSettings,
  PollOption,
  PrivacySettings,
  University,
  User,
  UserView,
} from "@/lib/types";
import { defaultNotifications, defaultPrivacy } from "@/lib/mock/users";

type UserRow = Tables<"users">;
type UniversityRow = Tables<"universities">;
type CategoryRow = Tables<"categories">;

function asRecord(value: Json): Record<string, Json | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function pickString<T extends string>(value: Json | undefined, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function pickBoolean(value: Json | undefined, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function toPrivacySettings(value: Json): PrivacySettings {
  const raw = asRecord(value);
  return {
    who_can_message: pickString(raw.who_can_message, ["everyone", "friends", "nobody"] as const, defaultPrivacy.who_can_message),
    who_can_see_profile: pickString(raw.who_can_see_profile, ["everyone", "university", "friends"] as const, defaultPrivacy.who_can_see_profile),
    who_can_see_interests: pickString(raw.who_can_see_interests, ["everyone", "university", "friends"] as const, defaultPrivacy.who_can_see_interests),
    visible_in_search: pickBoolean(raw.visible_in_search, defaultPrivacy.visible_in_search),
    read_receipts: pickBoolean(raw.read_receipts, defaultPrivacy.read_receipts),
  };
}

export function toNotificationSettings(value: Json): NotificationSettings {
  const raw = asRecord(value);
  const read = (key: keyof NotificationSettings) => pickBoolean(raw[key], defaultNotifications[key]);
  return {
    new_participant: read("new_participant"),
    new_message_in_post: read("new_message_in_post"),
    new_message_direct: read("new_message_direct"),
    new_follower: read("new_follower"),
    new_post_from_following: read("new_post_from_following"),
    event_reminder_1h: read("event_reminder_1h"),
    event_reminder_30m: read("event_reminder_30m"),
  };
}

export function toModeratorPermissions(value: Json): ModeratorPermissions {
  const raw = asRecord(value);
  return {
    can_post_media: pickBoolean(raw.can_post_media, false),
    can_pin: pickBoolean(raw.can_pin, false),
    can_poll: pickBoolean(raw.can_poll, false),
    can_kick: pickBoolean(raw.can_kick, false),
  };
}

/** polls.options — массив объектов ровно вида { label }. Проверено CHECK в 0005. */
export function toPollOptions(value: Json): PollOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const raw = asRecord(item);
    return typeof raw.label === "string" ? [{ label: raw.label }] : [];
  });
}

export function toNotificationPayload(value: Json): NotificationPayload {
  const raw = asRecord(value);
  const str = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : undefined);
  return {
    ...(str("actor_id") ? { actor_id: str("actor_id") } : {}),
    ...(str("actor_nickname") ? { actor_nickname: str("actor_nickname") } : {}),
    ...(raw.actor_avatar_url !== undefined
      ? { actor_avatar_url: typeof raw.actor_avatar_url === "string" ? raw.actor_avatar_url : null }
      : {}),
    ...(str("post_id") ? { post_id: str("post_id") } : {}),
    ...(str("post_title") ? { post_title: str("post_title") } : {}),
    ...(str("message_preview") ? { message_preview: str("message_preview") } : {}),
    ...(typeof raw.minutes_until === "number" ? { minutes_until: raw.minutes_until } : {}),
    ...(raw.changed === "time" || raw.changed === "place" || raw.changed === "time_place"
      ? { changed: raw.changed }
      : {}),
  };
}

export function toUniversity(row: UniversityRow): University {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    city: row.city,
    country: row.country,
    short_name: row.short_name,
    campus_lat: row.campus_lat,
    campus_lng: row.campus_lng,
  };
}

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    is_main: row.is_main,
    // `icon` хранится как text, чтобы набор иконок рос без миграции.
    icon: row.icon as Category["icon"],
  };
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    nickname: row.nickname,
    avatar_url: row.avatar_url,
    university_id: row.university_id,
    faculty: row.faculty,
    bio: row.bio,
    interests: row.interests,
    goals: row.goals,
    is_verified: row.is_verified,
    privacy_settings: toPrivacySettings(row.privacy_settings),
    notification_settings: toNotificationSettings(row.notification_settings),
    created_at: row.created_at,
  };
}

/** Социальный контекст, который `UserView` требует поверх строки `users`. */
export interface SocialFacts {
  follower_count: number;
  following_count: number;
  viewer_follows: boolean;
  follows_viewer: boolean;
  viewer_blocked: boolean;
}

export const noSocialFacts: SocialFacts = {
  follower_count: 0,
  following_count: 0,
  viewer_follows: false,
  follows_viewer: false,
  viewer_blocked: false,
};

export function toUserView(
  row: UserRow & { university: UniversityRow | null },
  facts: SocialFacts,
): UserView {
  if (!row.university) {
    throw new Error(`У пользователя ${row.nickname} не загружен университет`);
  }
  return {
    ...toUser(row),
    university: toUniversity(row.university),
    ...facts,
  };
}

/** Роль в чате идеи, вычисленная из множеств, а не запросом на каждую идею. */
export function roleIn(
  postId: string,
  authorId: string,
  viewerId: string | null,
  participantPosts: ReadonlySet<string>,
  moderatorPosts: ReadonlySet<string>,
): ChatRole {
  if (!viewerId) return "guest";
  if (authorId === viewerId) return "author";
  if (moderatorPosts.has(postId)) return "moderator";
  if (participantPosts.has(postId)) return "participant";
  return "guest";
}
