-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0007_views_functions.sql — the product rules, in the database        ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Every rule the UI enforces in lib/mock/index.ts and lib/format.ts exists
-- here a second time, because a client-side check is a convenience and a
-- policy is the actual guarantee. The pairs that must agree:
--
--   isInFeed(post, now)        → public.active_posts, post_cards.in_feed
--   isFriend(user)             → public.are_friends(a, b)
--   canEnterChat(post)         → public.can_enter_post_chat(post, member)
--   canMessage(user)           → public.can_message_user(target, sender)
--   canSeeProfile(user)        → public.can_see_profile(target, viewer)
--   canSeeInterests(user)      → public.can_see_interests(target, viewer)
--   roleOf(postId, userId)     → public.post_role(post, member)
--   seatsLeft/isFull           → public.participant_count(post), post_cards
--
-- Everything in this file is `security definer` unless noted: the policies in
-- 0008 call these functions, and a policy on public.users that itself queried
-- public.users under RLS would recurse. A definer function reads as the table
-- owner, which breaks the cycle — so these functions must never do anything
-- except answer the question they are named after.
--
-- public.current_user_id() already exists (0003) and is not repeated here.

/* ── development read switch ─────────────────────────────────────────── */

-- Stages 4 and 5 run against a database with no auth rows at all (see the
-- header of 0003): auth.uid() is NULL, current_user_id() is NULL, and every
-- policy below would deny. Rather than weakening the policies, every SELECT
-- policy starts with `public.open_read() or …`. The flag is one row, it is
-- read-only for clients, and flipping it to false at stage 6 turns the
-- database strict in a single statement:
--
--   update public.app_flags set open_read = false, updated_at = now();
--
-- It never relaxes INSERT, UPDATE or DELETE — writes always need a signed-in
-- viewer, which is exactly the posture stages 4-5 need (the UI still mutates
-- React state only).
create table if not exists public.app_flags (
  id          boolean primary key default true,
  open_read   boolean not null default true,
  updated_at  timestamptz not null default now(),

  -- One row, forever: the primary key can only ever hold `true`.
  constraint app_flags_single_row check (id)
);

insert into public.app_flags (id) values (true) on conflict (id) do nothing;

comment on table public.app_flags is
  'Single-row switchboard. open_read = true relaxes every SELECT policy while the app has no auth; set it to false at stage 6.';

create or replace function public.open_read()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select f.open_read from public.app_flags f where f.id), false);
$$;

comment on function public.open_read() is
  'True while the database is in development read mode. Read by every SELECT policy, by no write policy.';

/* ── small helpers ──────────────────────────────────────────────────── */

-- Storage paths are text, so `avatars/<uuid>/file.png` has to be cast before
-- it can be compared. An unparseable segment must mean "no access", not
-- "statement failed", which a bare cast cannot do.
create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

comment on function public.try_uuid(text) is
  'The uuid in `value`, or NULL when it is not one. Used by the storage policies in 0009.';

/* ── follow graph ───────────────────────────────────────────────────── */

create or replace function public.follows_user(follower uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.follows f
    where f.follower_id = follower
      and f.following_id = target
  );
$$;

comment on function public.follows_user(uuid, uuid) is
  'True when `follower` follows `target`. One-directional, like the table.';

-- The only definition of friendship in this product: a follow in both
-- directions. Nothing is stored, so unfollowing dissolves it immediately,
-- together with every privacy tier that depends on it.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null
     and b is not null
     and a <> b
     and public.follows_user(a, b)
     and public.follows_user(b, a);
$$;

comment on function public.are_friends(uuid, uuid) is
  'Mutual follow. lib/types.ts → isFriend(user). Never stored, always derived.';

-- Two people sit in the same idea chat. A closed profile still has to render
-- as a chat member and as a message author, otherwise the chat shows blanks,
-- so this widens the read policy on public.users (0008) by exactly that much.
create or replace function public.shares_post_with(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null
     and b is not null
     and exists (
       select 1
       from public.post_participants pa
       join public.post_participants pb on pb.post_id = pa.post_id
       where pa.user_id = a
         and pb.user_id = b
     );
$$;

comment on function public.shares_post_with(uuid, uuid) is
  'True when both users are participants of at least one common idea.';

/* ── roles inside one idea ──────────────────────────────────────────── */

create or replace function public.post_author_id(post uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.author_id from public.posts p where p.id = post;
$$;

create or replace function public.is_post_author(post uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select member is not null and public.post_author_id(post) = member;
$$;

create or replace function public.is_post_member(post uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.post_participants pp
    where pp.post_id = post
      and pp.user_id = member
  );
$$;

comment on function public.is_post_member(uuid, uuid) is
  'True when the user has a post_participants row — the author included, since a trigger puts them there.';

-- lib/types.ts → ChatRole. Returned as text: the union lives in TypeScript
-- and in this function, and adding a fourth role would be a product change,
-- not a type change.
create or replace function public.post_role(post uuid, member uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when member is null then 'guest'
    when public.post_author_id(post) = member then 'author'
    when exists (
      select 1 from public.post_moderators m
      where m.post_id = post and m.user_id = member
    ) then 'moderator'
    when public.is_post_member(post, member) then 'participant'
    else 'guest'
  end;
$$;

comment on function public.post_role(uuid, uuid) is
  'author | moderator | participant | guest. lib/mock/chat.ts → roleOf(postId, userId).';

-- Moderator rights are granted per person (lib/types.ts →
-- ModeratorPermissions). The author holds all four implicitly and never has a
-- post_moderators row.
create or replace function public.can_moderate(post uuid, actor uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when actor is null then false
    when permission_key not in ('can_post_media', 'can_pin', 'can_poll', 'can_kick') then false
    when public.post_author_id(post) = actor then true
    else coalesce((
      select (m.permissions ->> permission_key)::boolean
      from public.post_moderators m
      where m.post_id = post
        and m.user_id = actor
    ), false)
  end;
$$;

comment on function public.can_moderate(uuid, uuid, text) is
  'True when the actor holds the named right in this idea: the author always, a moderator per permissions. Keys: can_post_media, can_pin, can_poll, can_kick.';

create or replace function public.participant_count(post uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.post_participants pp
  where pp.post_id = post;
$$;

comment on function public.participant_count(uuid) is
  'Rows in post_participants for this idea, author included. The seat counter (lib/format.ts → seatsLeft) counts the same thing.';

/* ── chat access ────────────────────────────────────────────────────── */

-- lib/mock/index.ts → canEnterChat(post): whoever is already in the chat
-- stays in it, everyone else is measured against posts.chat_access. Closing
-- sign-up does not close the chat, which is why is_closed is not read here —
-- see can_join_post below.
create or replace function public.can_enter_post_chat(post uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when member is null then false
    when public.is_post_member(post, member) then true
    else coalesce((
      select case p.chat_access
        when 'everyone'  then true
        when 'followers' then public.follows_user(member, p.author_id)
        when 'friends'   then public.are_friends(member, p.author_id)
      end
      from public.posts p
      where p.id = post
    ), false)
  end;
$$;

comment on function public.can_enter_post_chat(uuid, uuid) is
  'Who may read the group chat of an idea: members always, others per posts.chat_access (everyone | followers | friends).';

-- Joining is stricter than entering: the chat is open to whoever passes
-- can_enter_post_chat, but a seat is only free while sign-up is open and the
-- cap is not reached. The INSERT policy on post_participants (0008) uses this.
create or replace function public.can_join_post(post uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_enter_post_chat(post, member)
     and not public.is_post_member(post, member)
     and coalesce((
       select not p.is_closed
          and (
            p.max_participants is null
            or public.participant_count(post) < p.max_participants
          )
       from public.posts p
       where p.id = post
     ), false);
$$;

comment on function public.can_join_post(uuid, uuid) is
  'can_enter_post_chat plus: not already a member, sign-up still open, a seat still free.';

create or replace function public.poll_post_id(poll uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.post_id from public.polls p where p.id = poll;
$$;

comment on function public.poll_post_id(uuid) is
  'The idea a poll belongs to. Lets the poll_votes policies reuse the chat rules.';

/* ── privacy ────────────────────────────────────────────────────────── */

-- lib/mock/index.ts → audienceAllows(): the shared body of who_can_see_profile
-- and who_can_see_interests. Yourself is always allowed.
create or replace function public.audience_allows(audience text, target uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when viewer is null or target is null then false
    when viewer = target then true
    when audience = 'everyone' then true
    when audience = 'university' then exists (
      select 1
      from public.users t
      join public.users v on v.university_id = t.university_id
      where t.id = target
        and v.id = viewer
    )
    when audience = 'friends' then public.are_friends(viewer, target)
    else false
  end;
$$;

comment on function public.audience_allows(text, uuid, uuid) is
  'everyone | university | friends, evaluated for one viewer. lib/types.ts → ProfileAudience.';

create or replace function public.can_see_profile(target uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.audience_allows(
    (select u.privacy_settings ->> 'who_can_see_profile' from public.users u where u.id = target),
    target,
    viewer
  );
$$;

comment on function public.can_see_profile(uuid, uuid) is
  'privacy_settings.who_can_see_profile of the target, evaluated for the viewer. lib/mock/index.ts → canSeeProfile(user).';

create or replace function public.can_see_interests(target uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.audience_allows(
    (select u.privacy_settings ->> 'who_can_see_interests' from public.users u where u.id = target),
    target,
    viewer
  );
$$;

comment on function public.can_see_interests(uuid, uuid) is
  'privacy_settings.who_can_see_interests. Interests live in a column, and RLS cannot hide one column of a visible row — the profile screen and the read layer apply this; see docs/DATABASE.md.';

-- lib/mock/dms.ts → canMessage(partner). Note the direction of the
-- arguments: the recipient decides, the sender is measured against it.
create or replace function public.can_message_user(target uuid, sender uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when sender is null or target is null or sender = target then false
    else coalesce((
      select case u.privacy_settings ->> 'who_can_message'
        when 'everyone' then true
        when 'friends'  then public.are_friends(sender, target)
        when 'nobody'   then false
        else false
      end
      from public.users u
      where u.id = target
    ), false)
  end;
$$;

comment on function public.can_message_user(uuid, uuid) is
  'privacy_settings.who_can_message of the recipient: everyone | friends | nobody. lib/mock/dms.ts → canMessage(partner).';

create or replace function public.notification_enabled(recipient uuid, setting text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (u.notification_settings ->> setting)::boolean
    from public.users u
    where u.id = recipient
  ), false);
$$;

comment on function public.notification_enabled(uuid, text) is
  'One switch out of lib/types.ts → NotificationSettings. Every notification trigger asks this before it writes a row.';

/* ── views ──────────────────────────────────────────────────────────── */

-- The feed rule, third copy (lib/format.ts → isInFeed, and post_cards below):
-- sign-up still open and not more than an hour past the start.
--
-- security_invoker = true: reading the view applies the caller's policy on
-- public.posts, so the view can never show more than the table would.
create or replace view public.active_posts
  with (security_invoker = true)
as
select p.*
from public.posts p
where not p.is_closed
  and p.date_start + interval '1 hour' > now();

comment on view public.active_posts is
  'Ideas that are still in the feed: not closed, less than an hour past date_start. Mirrors isInFeed(post, now) in lib/format.ts.';

-- Everything a feed card renders, in one row: lib/types.ts → PostView minus
-- the viewer-dependent parts (viewer_role comes from public.post_role, the
-- author relationship from public.follows_user).
--
-- BOTH FEED TABS ARE STRICTLY CHRONOLOGICAL, `order by date_start asc` — the
-- next departure first, in "Подписки" and in "Университет" alike. There is no
-- ranking, no recency boost and no pinned slot anywhere in the feed.
--
--   Подписки:   ... join follows f on f.following_id = post_cards.author_id
--               where f.follower_id = <me> and in_feed order by date_start
--   Университет: where university_id = <mine> and in_feed order by date_start
--
-- security_invoker = false (the Postgres default, written out because it is a
-- decision): this view joins public.users for the author block, and a profile
-- set to "university" or "friends" is invisible to most viewers under the
-- policy on public.users — an invoker view would silently drop those authors'
-- ideas out of the feed. The view therefore reads as its owner and exposes
-- exactly the public author block the UI contract names ("enough to render,
-- nothing private"): nickname, avatar, verification badge, faculty label and
-- university. Nothing else from public.users may ever be added here. The read
-- gate of public.posts is repeated in the WHERE clause so the view cannot be
-- used to go around it.
create or replace view public.post_cards
  with (security_invoker = false)
as
select
  p.id,
  p.author_id,
  p.title,
  p.description,
  p.category_id,
  p.date_start,
  p.geo_lat,
  p.geo_lng,
  p.geo_city,
  p.geo_address,
  p.geo_mode,
  p.geo_radius_m,
  p.max_participants,
  p.is_closed,
  p.chat_access,
  p.university_id,
  p.created_at,

  a.nickname    as author_nickname,
  a.avatar_url  as author_avatar_url,
  a.is_verified as author_is_verified,
  a.faculty     as author_faculty,

  un.name       as university_name,
  un.short_name as university_short_name,
  un.city       as university_city,

  c.name        as category_name,
  c.icon        as category_icon,
  c.is_main     as category_is_main,

  coalesce(pc.participant_count, 0)::integer as participant_count,

  -- NULL when the author set no cap, exactly like lib/format.ts → seatsLeft.
  case
    when p.max_participants is null then null
    else greatest(0, p.max_participants - coalesce(pc.participant_count, 0))::integer
  end as seats_left,

  (not p.is_closed and p.date_start + interval '1 hour' > now()) as in_feed

from public.posts p
join public.users a on a.id = p.author_id
join public.universities un on un.id = p.university_id
join public.categories c on c.id = p.category_id
left join (
  select pp.post_id, count(*) as participant_count
  from public.post_participants pp
  group by pp.post_id
) pc on pc.post_id = p.id
where public.open_read() or public.current_user_id() is not null;

comment on view public.post_cards is
  'One row per idea with the author, university, category and participant count a feed card needs. Both feed tabs order by date_start ascending. Reads as its owner — see the comment in 0007 before adding a column.';

/* ── triggers: derived columns ──────────────────────────────────────── */

-- An idea belongs to the university of the person hosting it, and authorship
-- never moves. Both are derived here so the client cannot send either.
create or replace function public.posts_set_university()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_university uuid;
begin
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;
    new.created_at := old.created_at;
  end if;

  select u.university_id
    into author_university
  from public.users u
  where u.id = new.author_id;

  if author_university is null then
    raise exception 'post %: author % has no profile row', coalesce(new.id::text, 'new'), new.author_id
      using errcode = 'foreign_key_violation';
  end if;

  new.university_id := author_university;
  return new;
end;
$$;

drop trigger if exists posts_set_university on public.posts;
create trigger posts_set_university
  before insert or update on public.posts
  for each row execute function public.posts_set_university();

comment on function public.posts_set_university() is
  'Copies university_id from the author profile and freezes author_id and created_at on update.';

-- "Member of this idea" is exactly "has a post_participants row", so the
-- author has to be in there from the first second.
create or replace function public.posts_add_author_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.post_participants (post_id, user_id)
  values (new.id, new.author_id)
  on conflict (post_id, user_id) do nothing;
  return null;
end;
$$;

drop trigger if exists posts_add_author_participant on public.posts;
create trigger posts_add_author_participant
  after insert on public.posts
  for each row execute function public.posts_add_author_participant();

comment on function public.posts_add_author_participant() is
  'Puts the author into post_participants when the idea is created.';

-- Verification is granted by a human reviewing the Верификация screen, never
-- by the person being verified. Deliberately NOT security definer: inside a
-- definer function current_user would be the function owner, and the check
-- below needs the role the request actually arrived with (`authenticated`
-- for a normal client, `service_role` for the review tooling, `postgres` for
-- migrations and the seed).
create or replace function public.users_guard_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_verified := false;
  else
    new.is_verified := old.is_verified;
    new.auth_user_id := old.auth_user_id;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists users_guard_verification on public.users;
create trigger users_guard_verification
  before insert or update on public.users
  for each row execute function public.users_guard_verification();

comment on function public.users_guard_verification() is
  'Nobody can verify themselves: is_verified, auth_user_id and created_at are reset to their stored values for anything but an admin role.';

-- At most one pinned message per idea. The partial unique index
-- messages_single_pin_idx (0005) guarantees it; this makes pinning a new
-- message simply unpin the old one instead of failing.
create or replace function public.messages_single_pin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_pinned then
    update public.messages m
       set is_pinned = false
     where m.post_id = new.post_id
       and m.id <> new.id
       and m.is_pinned;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_single_pin on public.messages;
create trigger messages_single_pin
  before insert or update of is_pinned on public.messages
  for each row execute function public.messages_single_pin();

comment on function public.messages_single_pin() is
  'Clears the previous pin of the same idea. The recursive call sets is_pinned = false and returns immediately.';

-- polls.options is index-aligned with poll_votes.option_index, so the upper
-- bound depends on another row and cannot be a CHECK.
create or replace function public.poll_votes_check_option()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  option_count integer;
begin
  select jsonb_array_length(p.options)
    into option_count
  from public.polls p
  where p.id = new.poll_id;

  if option_count is null then
    raise exception 'poll % does not exist', new.poll_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.option_index >= option_count then
    raise exception 'option_index % is out of range: poll % has % options',
      new.option_index, new.poll_id, option_count
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists poll_votes_check_option on public.poll_votes;
create trigger poll_votes_check_option
  before insert or update of poll_id, option_index on public.poll_votes
  for each row execute function public.poll_votes_check_option();

comment on function public.poll_votes_check_option() is
  'Keeps option_index inside the poll it belongs to.';

/* ── triggers: notifications ────────────────────────────────────────── */

-- Notification rows are written here and nowhere else: there is no INSERT
-- policy for `authenticated` on public.notifications (0008). Every trigger
-- asks notification_enabled() first, so a switched-off notification is never
-- stored — not stored and hidden. Payloads are denormalised (nickname, post
-- title, preview) so the list renders in one query and still reads correctly
-- after the idea is gone.
--
-- 'event_reminder' has no trigger: it depends on the clock, not on a write.
-- It belongs to a scheduled job (pg_cron, every few minutes, reading
-- notification_settings.event_reminder_1h / _30m) and is listed in
-- docs/ROADMAP.md rather than invented here.

create or replace function public.notify_new_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient  uuid;
  post_title text;
  actor_nick text;
  actor_av   text;
begin
  select p.author_id, p.title into recipient, post_title
  from public.posts p
  where p.id = new.post_id;

  if recipient is null or recipient = new.user_id then
    return null;
  end if;

  if not public.notification_enabled(recipient, 'new_participant') then
    return null;
  end if;

  select u.nickname, u.avatar_url into actor_nick, actor_av
  from public.users u
  where u.id = new.user_id;

  insert into public.notifications (user_id, type, payload)
  values (
    recipient,
    'new_participant',
    jsonb_build_object(
      'actor_id', new.user_id::text,
      'actor_nickname', actor_nick,
      'actor_avatar_url', actor_av,
      'post_id', new.post_id::text,
      'post_title', post_title
    )
  );

  return null;
end;
$$;

drop trigger if exists post_participants_notify_author on public.post_participants;
create trigger post_participants_notify_author
  after insert on public.post_participants
  for each row execute function public.notify_new_participant();

comment on function public.notify_new_participant() is
  'Tells the author that somebody joined. Never fires for the author joining their own idea.';

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_title text;
  actor_nick text;
  actor_av   text;
  base       jsonb;
begin
  select p.title into post_title from public.posts p where p.id = new.post_id;
  select u.nickname, u.avatar_url into actor_nick, actor_av
  from public.users u where u.id = new.author_id;

  base := jsonb_build_object(
    'actor_id', new.author_id::text,
    'actor_nickname', actor_nick,
    'actor_avatar_url', actor_av,
    'post_id', new.post_id::text,
    'post_title', post_title
  );

  -- A media-only message carries no preview key at all rather than an empty
  -- string (lib/types.ts → NotificationPayload.message_preview is optional).
  if btrim(new.content) <> '' then
    base := base || jsonb_build_object('message_preview', left(new.content, 140));
  end if;

  insert into public.notifications (user_id, type, payload)
  select pp.user_id, 'new_message', base
  from public.post_participants pp
  where pp.post_id = new.post_id
    and pp.user_id <> new.author_id
    and public.notification_enabled(pp.user_id, 'new_message_in_post');

  return null;
end;
$$;

drop trigger if exists messages_notify_participants on public.messages;
create trigger messages_notify_participants
  after insert on public.messages
  for each row execute function public.notify_new_message();

comment on function public.notify_new_message() is
  'One row per other participant of the idea, respecting notification_settings.new_message_in_post. Direct messages deliberately create no rows.';

create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_nick text;
  actor_av   text;
begin
  if not public.notification_enabled(new.following_id, 'new_follower') then
    return null;
  end if;

  select u.nickname, u.avatar_url into actor_nick, actor_av
  from public.users u where u.id = new.follower_id;

  insert into public.notifications (user_id, type, payload)
  values (
    new.following_id,
    'new_follower',
    jsonb_build_object(
      'actor_id', new.follower_id::text,
      'actor_nickname', actor_nick,
      'actor_avatar_url', actor_av
    )
  );

  return null;
end;
$$;

drop trigger if exists follows_notify_target on public.follows;
create trigger follows_notify_target
  after insert on public.follows
  for each row execute function public.notify_new_follower();

comment on function public.notify_new_follower() is
  'Tells the followed person. Unfollowing and re-following writes a second row — that is intended, it is a new event.';

create or replace function public.notify_new_post_from_following()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_nick text;
  actor_av   text;
begin
  select u.nickname, u.avatar_url into actor_nick, actor_av
  from public.users u where u.id = new.author_id;

  insert into public.notifications (user_id, type, payload)
  select
    f.follower_id,
    'new_post_from_following',
    jsonb_build_object(
      'actor_id', new.author_id::text,
      'actor_nickname', actor_nick,
      'actor_avatar_url', actor_av,
      'post_id', new.id::text,
      'post_title', new.title
    )
  from public.follows f
  where f.following_id = new.author_id
    and f.follower_id <> new.author_id
    and public.notification_enabled(f.follower_id, 'new_post_from_following');

  return null;
end;
$$;

drop trigger if exists posts_notify_followers on public.posts;
create trigger posts_notify_followers
  after insert on public.posts
  for each row execute function public.notify_new_post_from_following();

comment on function public.notify_new_post_from_following() is
  'Fans a new idea out to the author''s followers — the write behind the "Подписки" tab being worth opening.';

/* ── indexes for the paths 0001-0006 did not already cover ──────────── */

-- are_friends() and follows_user() look the pair up in both directions. The
-- unique constraint covers (follower_id, following_id); this covers the
-- reverse, which is the second half of every friendship check and of the
-- "Подписчики" list.
create index if not exists follows_pair_idx
  on public.follows (following_id, follower_id);

-- Search inside the feed window: category filter plus chronological order.
create index if not exists posts_category_feed_idx
  on public.posts (category_id, date_start)
  where not is_closed;

-- Search inside the feed window: city filter ("Указать город") plus order.
create index if not exists posts_city_feed_idx
  on public.posts (lower(geo_city), date_start)
  where not is_closed;

-- Chat history is read oldest-first; the descending index in 0005 serves the
-- chat list's "latest message". Both directions are one scan each.
create index if not exists messages_post_asc_idx
  on public.messages (post_id, created_at);

-- getMyIdeaChats(): the ideas one person belongs to, then their last message.
create index if not exists post_participants_user_post_idx
  on public.post_participants (user_id, post_id);

-- Notification list and badge in one index when the list is filtered by type.
create index if not exists notifications_user_type_idx
  on public.notifications (user_id, type, created_at desc);

/* ── grants ─────────────────────────────────────────────────────────── */

-- Same shape as 0003 and 0005: nothing is executable by `public`, everything
-- is executable by the three Supabase roles.
revoke execute on function public.open_read() from public;
revoke execute on function public.try_uuid(text) from public;
revoke execute on function public.follows_user(uuid, uuid) from public;
revoke execute on function public.are_friends(uuid, uuid) from public;
revoke execute on function public.shares_post_with(uuid, uuid) from public;
revoke execute on function public.post_author_id(uuid) from public;
revoke execute on function public.is_post_author(uuid, uuid) from public;
revoke execute on function public.is_post_member(uuid, uuid) from public;
revoke execute on function public.post_role(uuid, uuid) from public;
revoke execute on function public.can_moderate(uuid, uuid, text) from public;
revoke execute on function public.participant_count(uuid) from public;
revoke execute on function public.can_enter_post_chat(uuid, uuid) from public;
revoke execute on function public.can_join_post(uuid, uuid) from public;
revoke execute on function public.poll_post_id(uuid) from public;
revoke execute on function public.audience_allows(text, uuid, uuid) from public;
revoke execute on function public.can_see_profile(uuid, uuid) from public;
revoke execute on function public.can_see_interests(uuid, uuid) from public;
revoke execute on function public.can_message_user(uuid, uuid) from public;
revoke execute on function public.notification_enabled(uuid, text) from public;

grant execute on function public.open_read() to anon, authenticated, service_role;
grant execute on function public.try_uuid(text) to anon, authenticated, service_role;
grant execute on function public.follows_user(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.are_friends(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.shares_post_with(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.post_author_id(uuid) to anon, authenticated, service_role;
grant execute on function public.is_post_author(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.is_post_member(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.post_role(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_moderate(uuid, uuid, text) to anon, authenticated, service_role;
grant execute on function public.participant_count(uuid) to anon, authenticated, service_role;
grant execute on function public.can_enter_post_chat(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_join_post(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.poll_post_id(uuid) to anon, authenticated, service_role;
grant execute on function public.audience_allows(text, uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_see_profile(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_see_interests(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_message_user(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.notification_enabled(uuid, text) to anon, authenticated, service_role;

-- The trigger functions are called by the triggers, never by a client.
revoke execute on function public.posts_set_university() from public;
revoke execute on function public.posts_add_author_participant() from public;
revoke execute on function public.users_guard_verification() from public;
revoke execute on function public.messages_single_pin() from public;
revoke execute on function public.poll_votes_check_option() from public;
revoke execute on function public.notify_new_participant() from public;
revoke execute on function public.notify_new_message() from public;
revoke execute on function public.notify_new_follower() from public;
revoke execute on function public.notify_new_post_from_following() from public;

-- Views are read-only everywhere. The policies that govern them live on the
-- tables underneath (0008).
revoke all on table public.active_posts from anon, authenticated;
revoke all on table public.post_cards from anon, authenticated;
grant select on table public.active_posts to anon, authenticated, service_role;
grant select on table public.post_cards to anon, authenticated, service_role;
