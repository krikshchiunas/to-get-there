-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0003_users.sql — profiles, decoupled from auth                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Registration is the LAST stage of this project (docs/ROADMAP.md, stage 6).
-- Everything before it has to work with a database that contains no auth
-- rows at all. Hence the deliberate split:
--
--   users.id            own uuid, generated here, referenced by every other
--                       table. Stable whether or not an auth user exists.
--   users.auth_user_id  nullable FK to auth.users. Filled in at stage 6 by
--                       supabase/later/auth_bridge.sql. NULL for every
--                       seeded row.
--
-- public.current_user_id() translates auth.uid() into users.id and is the
-- single entry point every RLS policy uses. Signed out it returns NULL, and
-- every policy then denies — which is why development reads go through
-- public.open_read() (0007) instead of weakened policies.

/* ── helper: validating a tag array ─────────────────────────────────── */

-- `interests` and `goals` are plain text arrays (lib/types.ts → User).
-- A CHECK constraint may not contain a subquery, so the element-level
-- validation lives in this immutable helper.
create or replace function public.is_tag_array(arr text[], max_items integer, max_len integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select arr is not null
     and coalesce(array_length(arr, 1), 0) <= max_items
     and array_position(arr, null) is null
     and not exists (
       select 1
       from unnest(arr) as t(value)
       where char_length(btrim(t.value)) not between 1 and max_len
     );
$$;

comment on function public.is_tag_array(text[], integer, integer) is
  'True when every element of the array is non-null, trimmed-non-empty and within max_len, and the array holds at most max_items.';

/* ── users ──────────────────────────────────────────────────────────── */

create table if not exists public.users (
  id                     uuid primary key default gen_random_uuid(),

  -- Nullable on purpose: seeded and development rows have no auth user.
  auth_user_id           uuid unique references auth.users (id) on delete cascade,

  nickname               text not null,
  avatar_url             text,
  university_id          uuid not null references public.universities (id) on delete restrict,
  faculty                text,
  bio                    text,
  interests              text[] not null default '{}',
  goals                  text[] not null default '{}',

  -- Identity verification. Grants no privileges anywhere — it only signals
  -- trust (components/ui/verified.tsx). A user can never set it themselves:
  -- the column is not in the UPDATE grant for `authenticated` (0008) and a
  -- trigger resets it (0007).
  is_verified            boolean not null default false,

  privacy_settings       jsonb not null default
    '{"who_can_message":"everyone","who_can_see_profile":"everyone","who_can_see_interests":"everyone","visible_in_search":true}'::jsonb,

  notification_settings  jsonb not null default
    '{"new_participant":true,"new_message_in_post":true,"new_message_direct":true,"new_follower":true,"new_post_from_following":true,"event_reminder_1h":true,"event_reminder_30m":true}'::jsonb,

  created_at             timestamptz not null default now(),

  -- Nicknames are lower case and unique. lib/types.ts carries them as plain
  -- strings and the profile route is /u/<nickname>, so the stored value is
  -- the URL segment: no citext, no case folding at query time, and
  -- `.eq('nickname', segment)` is an exact index lookup.
  constraint users_nickname_fmt check (nickname ~ '^[a-z0-9][a-z0-9._]{2,23}$'),

  constraint users_avatar_url_set check (avatar_url is null or char_length(btrim(avatar_url)) > 0),
  constraint users_faculty_len    check (faculty is null or char_length(btrim(faculty)) between 2 and 120),
  constraint users_bio_len        check (bio is null or char_length(bio) <= 400),
  constraint users_interests_ok   check (public.is_tag_array(interests, 20, 40)),
  constraint users_goals_ok       check (public.is_tag_array(goals, 10, 80)),

  -- Exact shape of lib/types.ts → PrivacySettings. The `-` removes the four
  -- known keys; an empty object left over means there are no extra keys.
  -- coalesce() everywhere because a CHECK that evaluates to NULL passes.
  constraint users_privacy_shape check (
    jsonb_typeof(privacy_settings) = 'object'
    and privacy_settings - array[
      'who_can_message', 'who_can_see_profile', 'who_can_see_interests', 'visible_in_search'
    ] = '{}'::jsonb
    and coalesce(privacy_settings ->> 'who_can_message', '') in ('everyone', 'friends', 'nobody')
    and coalesce(privacy_settings ->> 'who_can_see_profile', '') in ('everyone', 'university', 'friends')
    and coalesce(privacy_settings ->> 'who_can_see_interests', '') in ('everyone', 'university', 'friends')
    and coalesce(jsonb_typeof(privacy_settings -> 'visible_in_search'), '') = 'boolean'
  ),

  -- Exact shape of lib/types.ts → NotificationSettings: seven booleans,
  -- every one of them true by default.
  constraint users_notifications_shape check (
    jsonb_typeof(notification_settings) = 'object'
    and notification_settings - array[
      'new_participant', 'new_message_in_post', 'new_message_direct', 'new_follower',
      'new_post_from_following', 'event_reminder_1h', 'event_reminder_30m'
    ] = '{}'::jsonb
    and coalesce(jsonb_typeof(notification_settings -> 'new_participant'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'new_message_in_post'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'new_message_direct'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'new_follower'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'new_post_from_following'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'event_reminder_1h'), '') = 'boolean'
    and coalesce(jsonb_typeof(notification_settings -> 'event_reminder_30m'), '') = 'boolean'
  )
);

create unique index if not exists users_nickname_key on public.users (nickname);
create index if not exists users_university_idx on public.users (university_id, nickname);
create index if not exists users_created_idx on public.users (created_at desc);

-- People search: nickname substring (searchUsers in lib/mock/index.ts) and
-- interest overlap.
create index if not exists users_nickname_trgm_idx
  on public.users using gin (nickname extensions.gin_trgm_ops);
create index if not exists users_interests_idx
  on public.users using gin (interests);

-- `visible_in_search = false` has to drop a profile out of people search
-- without hiding it from the chats it takes part in, so it is a query-level
-- filter, not an RLS rule. This partial index serves exactly that query.
create index if not exists users_searchable_idx
  on public.users (nickname)
  where (privacy_settings ->> 'visible_in_search') = 'true';

comment on table public.users is
  'lib/types.ts → User. One row per profile. auth_user_id stays NULL until stage 6 (registration).';
comment on column public.users.auth_user_id is
  'Nullable FK to auth.users. NULL means: profile exists, nobody can sign in as it. Filled by supabase/later/auth_bridge.sql.';
comment on column public.users.nickname is
  'Lower case, unique, 3-24 chars of [a-z0-9._]. This is the /u/<nickname> URL segment.';
comment on column public.users.is_verified is
  'Identity verification only. Grants no privileges. Not writable by the user.';

/* ── current_user_id ────────────────────────────────────────────────── */

-- The bridge from Supabase auth to our own primary key, used by every
-- policy and by every can_* function.
--
-- security definer: public.users is itself behind RLS, and a policy on
-- public.users that queried public.users would recurse. The definer reads
-- as the table owner and so sees the one row it needs.
-- stable: one lookup per statement.
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid();
$$;

comment on function public.current_user_id() is
  'users.id of the signed-in viewer, NULL when signed out or when the auth user has no profile row yet. The only identity source for RLS.';

revoke execute on function public.current_user_id() from public;
grant execute on function public.current_user_id() to anon, authenticated, service_role;
revoke execute on function public.is_tag_array(text[], integer, integer) from public;
grant execute on function public.is_tag_array(text[], integer, integer) to anon, authenticated, service_role;
