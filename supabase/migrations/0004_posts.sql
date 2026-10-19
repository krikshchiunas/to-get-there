-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0004_posts.sql — the post-idea, its roster and its moderators        ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- The unit of the product. A post has a time (date_start), a place (geo_*)
-- and a number of seats (max_participants). It leaves both feed tabs when
-- the author closes sign-up or one hour after it starts; the chat stays
-- reachable for everyone who was in it. That rule lives in exactly three
-- places and they must agree:
--
--   lib/format.ts        → isInFeed(post, now)
--   public.active_posts  → 0007
--   public.post_cards    → 0007, column `in_feed`

/* ── posts ──────────────────────────────────────────────────────────── */

create table if not exists public.posts (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references public.users (id) on delete cascade,
  title             text not null,
  description       text not null default '',
  category_id       uuid not null references public.categories (id) on delete restrict,

  -- When the thing actually happens. Not the creation time.
  date_start        timestamptz not null,

  geo_lat           double precision,
  geo_lng           double precision,
  geo_city          text not null,
  geo_address       text,
  geo_mode          public.geo_mode not null default 'city',

  -- lib/types.ts → GeoRadius. Only meaningful with geo_mode = 'radius'.
  geo_radius_m      integer,

  -- NULL = the author set no cap. lib/format.ts → seatsLeft/isFull.
  max_participants  integer,

  -- The author closed sign-up. The post leaves the feed, the chat stays.
  is_closed         boolean not null default false,

  chat_access       public.chat_access not null default 'everyone',

  -- Derived from the author's profile by a trigger (0007), never sent by
  -- the client: an idea belongs to the university of the person hosting it.
  university_id     uuid not null references public.universities (id) on delete restrict,

  created_at        timestamptz not null default now(),

  constraint posts_title_len       check (char_length(btrim(title)) between 3 and 120),
  constraint posts_description_len check (char_length(description) <= 2000),
  constraint posts_city_len        check (char_length(btrim(geo_city)) between 2 and 80),
  constraint posts_address_len     check (geo_address is null or char_length(btrim(geo_address)) between 2 and 200),
  constraint posts_date_sane       check (date_start > timestamptz '2020-01-01'),

  -- Coordinates come as a pair or not at all.
  constraint posts_geo_pair        check ((geo_lat is null) = (geo_lng is null)),
  constraint posts_geo_lat_range   check (geo_lat is null or geo_lat between -90 and 90),
  constraint posts_geo_lng_range   check (geo_lng is null or geo_lng between -180 and 180),

  -- A radius belongs to geo_mode 'radius' and to nothing else, and it is
  -- one of the five steps the UI offers (lib/types.ts → GeoRadius).
  constraint posts_radius_mode     check ((geo_mode = 'radius') = (geo_radius_m is not null)),
  constraint posts_radius_steps    check (geo_radius_m is null or geo_radius_m in (500, 1000, 2000, 5000, 10000)),

  -- 'area' means the author pinned a place down, so it carries its label.
  constraint posts_area_address    check (geo_mode <> 'area' or geo_address is not null),

  constraint posts_max_range       check (max_participants is null or max_participants between 2 and 500)
);

-- Feed: strictly chronological, next departure first, closed posts never
-- listed. The partial predicate is immutable, so the index is usable; the
-- one-hour grace window is a range condition on date_start on top of it.
create index if not exists posts_feed_idx
  on public.posts (date_start)
  where not is_closed;

create index if not exists posts_university_feed_idx
  on public.posts (university_id, date_start)
  where not is_closed;

create index if not exists posts_author_feed_idx
  on public.posts (author_id, date_start)
  where not is_closed;

-- Profile: hosted ideas, newest first, open and past alike.
create index if not exists posts_author_idx on public.posts (author_id, date_start desc);

create index if not exists posts_category_idx on public.posts (category_id, date_start);
create index if not exists posts_city_idx on public.posts (lower(geo_city), date_start);
create index if not exists posts_created_idx on public.posts (created_at desc);

-- Search needle against title and description (searchPosts).
create index if not exists posts_title_trgm_idx
  on public.posts using gin (title extensions.gin_trgm_ops);
create index if not exists posts_description_trgm_idx
  on public.posts using gin (description extensions.gin_trgm_ops);

comment on table public.posts is
  'lib/types.ts → Post. One row per post-idea.';
comment on column public.posts.date_start is
  'When it happens. The feed sorts on this ascending, in both tabs.';
comment on column public.posts.is_closed is
  'Author closed sign-up. Post leaves the feed, chat stays open.';
comment on column public.posts.university_id is
  'Taken from the author profile by trigger posts_set_university (0007). Not editable.';

/* ── post_participants ──────────────────────────────────────────────── */

-- The chat roster. The author is always in it (trigger
-- posts_add_author_participant, 0007), so "member of this idea" is exactly
-- "has a row here".
create table if not exists public.post_participants (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),

  constraint post_participants_unique unique (post_id, user_id)
);

-- Roster of one idea, in join order.
create index if not exists post_participants_post_idx
  on public.post_participants (post_id, joined_at);

-- "My idea chats" (getMyIdeaChats) and the seat counter.
create index if not exists post_participants_user_idx
  on public.post_participants (user_id, joined_at desc);

comment on table public.post_participants is
  'lib/types.ts → PostParticipant. Membership of an idea chat. Includes the author.';

/* ── post_moderators ────────────────────────────────────────────────── */

-- Moderator rights are granted per person by the author. The author holds
-- all of them implicitly and never appears in this table.
create table if not exists public.post_moderators (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  permissions  jsonb not null default
    '{"can_post_media":false,"can_pin":false,"can_poll":false,"can_kick":false}'::jsonb,

  constraint post_moderators_unique unique (post_id, user_id),

  -- Exact shape of lib/types.ts → ModeratorPermissions.
  constraint post_moderators_permissions_shape check (
    jsonb_typeof(permissions) = 'object'
    and permissions - array['can_post_media', 'can_pin', 'can_poll', 'can_kick'] = '{}'::jsonb
    and coalesce(jsonb_typeof(permissions -> 'can_post_media'), '') = 'boolean'
    and coalesce(jsonb_typeof(permissions -> 'can_pin'), '') = 'boolean'
    and coalesce(jsonb_typeof(permissions -> 'can_poll'), '') = 'boolean'
    and coalesce(jsonb_typeof(permissions -> 'can_kick'), '') = 'boolean'
  )
);

create index if not exists post_moderators_post_idx on public.post_moderators (post_id);
create index if not exists post_moderators_user_idx on public.post_moderators (user_id);

comment on table public.post_moderators is
  'lib/types.ts → PostModerator. Per-person rights inside one idea chat: can_post_media, can_pin, can_poll, can_kick.';
