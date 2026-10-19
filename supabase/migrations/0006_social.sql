-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0006_social.sql — follow graph and notifications                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Following is one-directional. A mutual follow is a friendship, and that
-- is the only definition of "friends" in this product:
--
--   lib/types.ts            → isFriend(user)
--   public.are_friends(a,b) → 0007
--
-- Friendship is never stored. It is always derived from two follow rows, so
-- unfollowing dissolves it immediately — including the privacy tiers that
-- depend on it (who_can_message = 'friends', chat_access = 'friends').

/* ── follows ────────────────────────────────────────────────────────── */

create table if not exists public.follows (
  id            uuid primary key default gen_random_uuid(),
  follower_id   uuid not null references public.users (id) on delete cascade,
  following_id  uuid not null references public.users (id) on delete cascade,
  created_at    timestamptz not null default now(),

  constraint follows_unique  unique (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

-- "Following" feed tab: the ideas of the people I follow.
create index if not exists follows_follower_idx on public.follows (follower_id, created_at desc);

-- Follower list of a profile, and the fan-out for new_post_from_following.
create index if not exists follows_following_idx on public.follows (following_id, created_at desc);

comment on table public.follows is
  'lib/types.ts → Follow. One-directional. A pair in both directions is a friendship.';

/* ── notifications ──────────────────────────────────────────────────── */

-- Rows are written by the triggers in 0007 and by nothing else: there is no
-- INSERT policy for `authenticated` (0008). The recipient may mark a row
-- read and may delete it.
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  type        public.notification_type not null,

  -- Denormalised on purpose: a notification row keeps the nickname and the
  -- post title it was written with, so the list renders in one query and
  -- still reads correctly after the post is gone.
  payload     jsonb not null default '{}'::jsonb,

  is_read     boolean not null default false,
  created_at  timestamptz not null default now(),

  -- Every key of lib/types.ts → NotificationPayload is optional, so the
  -- shape check is "no keys beyond these".
  constraint notifications_payload_shape check (
    jsonb_typeof(payload) = 'object'
    and payload - array[
      'actor_id', 'actor_nickname', 'actor_avatar_url',
      'post_id', 'post_title', 'message_preview', 'minutes_until'
    ] = '{}'::jsonb
    and (not payload ? 'actor_id'       or coalesce(jsonb_typeof(payload -> 'actor_id'), '') = 'string')
    and (not payload ? 'actor_nickname' or coalesce(jsonb_typeof(payload -> 'actor_nickname'), '') = 'string')
    and (not payload ? 'post_id'        or coalesce(jsonb_typeof(payload -> 'post_id'), '') = 'string')
    and (not payload ? 'post_title'     or coalesce(jsonb_typeof(payload -> 'post_title'), '') = 'string')
    and (not payload ? 'minutes_until'  or coalesce(jsonb_typeof(payload -> 'minutes_until'), '') = 'number')
  )
);

-- The notification list: one user, newest first.
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- The badge in components/nav/bottom-nav.tsx: count of unread rows.
create index if not exists notifications_unread_idx
  on public.notifications (user_id)
  where not is_read;

comment on table public.notifications is
  'lib/types.ts → Notification. Written by the trigger set in 0007; the recipient only flips is_read.';
comment on column public.notifications.payload is
  'lib/types.ts → NotificationPayload. actor_avatar_url may be JSON null, every key is optional.';
