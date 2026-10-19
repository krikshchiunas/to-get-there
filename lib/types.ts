/**
 * Domain types for To Get There.
 *
 * Row types mirror the Postgres schema in supabase/migrations exactly
 * (snake_case, nullable where the column is nullable) so that swapping mock
 * reads for Supabase queries needs no mapping layer. Types suffixed `View`
 * are read models: a row plus the joins a screen needs.
 */

export type UUID = string;
/** Timestamptz serialised as ISO 8601, e.g. "2026-10-23T18:00:00+02:00". */
export type Timestamp = string;

/* ── reference data ─────────────────────────────────────────────── */

export interface University {
  id: UUID;
  name: string;
  /** Email domain used by the verification step, e.g. "tu-berlin.de". */
  domain: string;
  city: string;
  country: string;
  /** Two letter code shown on cards where the full name will not fit. */
  short_name: string;
}

export interface Category {
  id: UUID;
  name: string;
  /** Main categories show up front; the rest live behind the "Другое" button. */
  is_main: boolean;
  /** Key into the icon set, see components/ui/icon.tsx. */
  icon: IconName;
}

/* ── users ──────────────────────────────────────────────────────── */

export type ProfileAudience = "everyone" | "university" | "friends";
export type MessageAudience = "everyone" | "friends" | "nobody";

export interface PrivacySettings {
  who_can_message: MessageAudience;
  who_can_see_profile: ProfileAudience;
  who_can_see_interests: ProfileAudience;
  visible_in_search: boolean;
}

export interface NotificationSettings {
  new_participant: boolean;
  new_message_in_post: boolean;
  new_message_direct: boolean;
  new_follower: boolean;
  new_post_from_following: boolean;
  event_reminder_1h: boolean;
  event_reminder_30m: boolean;
}

export interface User {
  id: UUID;
  nickname: string;
  avatar_url: string | null;
  university_id: UUID;
  faculty: string | null;
  bio: string | null;
  interests: string[];
  goals: string[];
  /** Identity verification. Grants no privileges — it only signals trust. */
  is_verified: boolean;
  privacy_settings: PrivacySettings;
  notification_settings: NotificationSettings;
  created_at: Timestamp;
}

/** The author block on a card: enough to render, nothing private. */
export interface UserView extends User {
  university: University;
  follower_count: number;
  following_count: number;
  /** Relationship of the signed-in viewer to this user. */
  viewer_follows: boolean;
  follows_viewer: boolean;
}

/** Mutual follow. Drives the "friends" tier in privacy settings. */
export function isFriend(user: Pick<UserView, "viewer_follows" | "follows_viewer">): boolean {
  return user.viewer_follows && user.follows_viewer;
}

/* ── posts ──────────────────────────────────────────────────────── */

/** Who may enter the group chat of an idea. */
export type ChatAccess = "everyone" | "followers" | "friends";

/** How the author pinned the location down when creating the post. */
export type GeoMode = "radius" | "area" | "city";

export type GeoRadius = 500 | 1000 | 2000 | 5000 | 10000;

export interface Post {
  id: UUID;
  author_id: UUID;
  title: string;
  description: string;
  category_id: UUID;
  /** Date and time the thing actually happens. */
  date_start: Timestamp;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_city: string;
  geo_address: string | null;
  geo_mode: GeoMode;
  geo_radius_m: GeoRadius | null;
  max_participants: number | null;
  /** Author closed the sign-up. The post leaves the feed, the chat stays. */
  is_closed: boolean;
  chat_access: ChatAccess;
  university_id: UUID;
  created_at: Timestamp;
}

export type ChatRole = "author" | "moderator" | "participant" | "guest";

export interface PostView extends Post {
  author: UserView;
  university: University;
  category: Category;
  participant_count: number;
  /** Role of the signed-in viewer in this idea. */
  viewer_role: ChatRole;
}

export interface PostParticipant {
  id: UUID;
  post_id: UUID;
  user_id: UUID;
  joined_at: Timestamp;
}

export interface ParticipantView extends PostParticipant {
  user: UserView;
  role: ChatRole;
  permissions: ModeratorPermissions | null;
}

/** Each right is granted per moderator by the author. */
export interface ModeratorPermissions {
  can_post_media: boolean;
  can_pin: boolean;
  can_poll: boolean;
  can_kick: boolean;
}

export interface PostModerator {
  id: UUID;
  post_id: UUID;
  user_id: UUID;
  permissions: ModeratorPermissions;
}

/* ── idea chat ──────────────────────────────────────────────────── */

export interface Message {
  id: UUID;
  post_id: UUID;
  author_id: UUID;
  content: string;
  media_url: string | null;
  is_pinned: boolean;
  created_at: Timestamp;
}

export interface MessageView extends Message {
  author: UserView;
  role: ChatRole;
  /**
   * Откуда показывать картинку: подписанная ссылка на файл в приватном
   * бакете (живёт час) или локальный blob: до загрузки. null — файла нет
   * или читать его нельзя.
   */
  media_src?: string | null;
}

export interface PollOption {
  label: string;
}

export interface Poll {
  id: UUID;
  post_id: UUID;
  created_by: UUID;
  question: string;
  options: PollOption[];
  created_at: Timestamp;
}

export interface PollVote {
  id: UUID;
  poll_id: UUID;
  user_id: UUID;
  option_index: number;
}

export interface PollView extends Poll {
  author: UserView;
  /** Votes per option, index-aligned with `options`. Results are public. */
  tally: number[];
  total_votes: number;
  /** Which option the viewer picked, or null. */
  viewer_choice: number | null;
}

/* ── direct messages ────────────────────────────────────────────── */

export interface DirectMessage {
  id: UUID;
  sender_id: UUID;
  receiver_id: UUID;
  content: string;
  media_url: string | null;
  created_at: Timestamp;
}

/** One row per conversation in the chat list. */
export interface ConversationView {
  /** The other person. Conversations are keyed by partner id. */
  partner: UserView;
  last_message: DirectMessage;
  unread_count: number;
  /** False when the partner's privacy settings block the viewer. */
  can_reply: boolean;
}

/* ── social graph ───────────────────────────────────────────────── */

export interface Follow {
  id: UUID;
  follower_id: UUID;
  following_id: UUID;
  created_at: Timestamp;
}

/* ── notifications ──────────────────────────────────────────────── */

export type NotificationType =
  | "new_participant"
  | "new_message"
  | "new_follower"
  | "new_post_from_following"
  | "event_reminder"
  | "verification_passed"
  | "verification_failed";

export interface NotificationPayload {
  actor_id?: UUID;
  actor_nickname?: string;
  actor_avatar_url?: string | null;
  post_id?: UUID;
  post_title?: string;
  message_preview?: string;
  /** Minutes until the event, for event_reminder. */
  minutes_until?: number;
}

export interface Notification {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  payload: NotificationPayload;
  is_read: boolean;
  created_at: Timestamp;
}

/* ── feed and search ────────────────────────────────────────────── */

export type FeedTab = "following" | "university";

/** Time-of-day window, minutes from midnight. 18:00–23:00 -> [1080, 1380]. */
export interface TimeWindow {
  from_minutes: number;
  to_minutes: number;
}

export interface SearchFilters {
  query: string;
  category_ids: UUID[];
  /** A single day, or the start of a range. ISO date, "2026-10-24". */
  date_from: string | null;
  date_to: string | null;
  time_window: TimeWindow | null;
  geo_mode: GeoMode | null;
  geo_radius_m: GeoRadius | null;
  geo_city: string | null;
}

export const emptyFilters: SearchFilters = {
  query: "",
  category_ids: [],
  date_from: null,
  date_to: null,
  time_window: null,
  geo_mode: null,
  geo_radius_m: null,
  geo_city: null,
};

/* ── icons ──────────────────────────────────────────────────────── */

/** Keys rendered by components/ui/icon.tsx. Keep the two in sync. */
export type IconName =
  | "feed"
  | "search"
  | "plus"
  | "chat"
  | "person"
  | "bell"
  | "check"
  | "close"
  | "back"
  | "pin"
  | "poll"
  | "image"
  | "send"
  | "settings"
  | "shield"
  | "lock"
  | "seat"
  | "clock"
  | "place"
  | "calendar"
  | "glass"
  | "book"
  | "ball"
  | "plate"
  | "ticket"
  | "note"
  | "cards"
  | "bike"
  | "camera"
  | "globe"
  | "heart"
  | "briefcase"
  | "more"
  | "sparkle"
  | "chevron";
