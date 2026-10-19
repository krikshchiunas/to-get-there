-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0008_rls.sql — row level security on every table                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Two layers, and they do different jobs:
--
--   GRANTS decide which columns a role may touch at all. This is how
--   users.is_verified becomes unwritable and how `authenticated` can flip
--   messages.is_pinned without being able to rewrite somebody's message.
--
--   POLICIES decide which rows. Every policy is one call into 0007, which
--   keeps the product rule in a single place and keeps the policies free of
--   recursion: the functions are `security definer`, so a policy on
--   public.users may ask can_see_profile() without re-entering the policy it
--   is currently evaluating.
--
-- Shape of every SELECT policy:
--
--   public.open_read() or <the real rule>
--
-- open_read() is true while the app has no auth (0007). It appears in no
-- INSERT, UPDATE or DELETE policy — writes always need current_user_id().
--
-- `service_role` bypasses RLS entirely (it is created with BYPASSRLS), which
-- is why the review tooling can set is_verified and why nothing here needs a
-- back door. The seed runs as `postgres`, the table owner, and is exempt for
-- the same reason.
--
-- Policies are dropped before they are created so `supabase db reset` can
-- replay this file.

/* ── reference data: world readable, never client writable ──────────── */

alter table public.universities enable row level security;
alter table public.categories   enable row level security;
alter table public.app_flags    enable row level security;

revoke all on table public.universities from anon, authenticated;
revoke all on table public.categories   from anon, authenticated;
revoke all on table public.app_flags    from anon, authenticated;

grant select on table public.universities to anon, authenticated;
grant select on table public.categories   to anon, authenticated;
grant select on table public.app_flags    to anon, authenticated;

drop policy if exists universities_select_all on public.universities;
create policy universities_select_all on public.universities
  for select to anon, authenticated
  using (true);

drop policy if exists categories_select_all on public.categories;
create policy categories_select_all on public.categories
  for select to anon, authenticated
  using (true);

-- Readable so a client can tell which posture the database is in; writable
-- only by the service role and by migrations.
drop policy if exists app_flags_select_all on public.app_flags;
create policy app_flags_select_all on public.app_flags
  for select to anon, authenticated
  using (true);

/* ── users ──────────────────────────────────────────────────────────── */

alter table public.users enable row level security;

revoke all on table public.users from anon, authenticated;
grant select on table public.users to anon, authenticated;

-- The columns a person owns. is_verified is absent on purpose (identity
-- verification is granted by review, see 0003 and the trigger in 0007), and
-- so are id, auth_user_id, university_id and created_at: changing your
-- university means changing which feed your ideas belong to, which is a
-- support action, not a settings toggle.
grant update (
  nickname,
  avatar_url,
  faculty,
  bio,
  interests,
  goals,
  privacy_settings,
  notification_settings
) on table public.users to authenticated;

grant delete on table public.users to authenticated;

-- Reading a profile row follows privacy_settings.who_can_see_profile, with
-- one documented widening: somebody you share an idea chat with is visible,
-- because a chat whose members render as blanks is broken. The per-column
-- rule (who_can_see_interests) cannot be expressed in RLS — a policy hides
-- rows, not columns — so the profile screen applies can_see_interests() on
-- top of this. See docs/DATABASE.md.
drop policy if exists users_select_visible on public.users;
create policy users_select_visible on public.users
  for select to anon, authenticated
  using (
    public.open_read()
    or id = public.current_user_id()
    or public.can_see_profile(id, public.current_user_id())
    or public.shares_post_with(id, public.current_user_id())
  );

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using (id = public.current_user_id())
  with check (id = public.current_user_id());

drop policy if exists users_delete_own on public.users;
create policy users_delete_own on public.users
  for delete to authenticated
  using (id = public.current_user_id());

-- No INSERT policy. Profiles are created by the auth bridge
-- (supabase/later/auth_bridge.sql), a definer trigger owned by postgres, and
-- by the seed. A client may never invent a profile row.

/* ── posts ──────────────────────────────────────────────────────────── */

alter table public.posts enable row level security;

revoke all on table public.posts from anon, authenticated;
grant select on table public.posts to anon, authenticated;
grant insert on table public.posts to authenticated;
grant delete on table public.posts to authenticated;

-- author_id, university_id and created_at are derived and frozen by
-- posts_set_university (0007); leaving them out of the grant means a client
-- gets a privilege error instead of a silently ignored field.
grant update (
  title,
  description,
  category_id,
  date_start,
  geo_lat,
  geo_lng,
  geo_city,
  geo_address,
  geo_mode,
  geo_radius_m,
  max_participants,
  is_closed,
  chat_access
) on table public.posts to authenticated;

-- An idea is the public face of the product: every signed-in person sees
-- every idea, which is what makes the "Университет" tab and search possible.
-- Only the chat behind it is gated (public.messages below).
drop policy if exists posts_select_signed_in on public.posts;
create policy posts_select_signed_in on public.posts
  for select to anon, authenticated
  using (public.open_read() or public.current_user_id() is not null);

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (author_id = public.current_user_id());

-- Closing sign-up ("Закрыть набор") is an UPDATE of is_closed, so this is
-- also the policy that makes closing an author-only action.
drop policy if exists posts_update_author on public.posts;
create policy posts_update_author on public.posts
  for update to authenticated
  using (author_id = public.current_user_id())
  with check (author_id = public.current_user_id());

drop policy if exists posts_delete_author on public.posts;
create policy posts_delete_author on public.posts
  for delete to authenticated
  using (author_id = public.current_user_id());

/* ── post_participants ──────────────────────────────────────────────── */

alter table public.post_participants enable row level security;

revoke all on table public.post_participants from anon, authenticated;
grant select on table public.post_participants to anon, authenticated;
grant insert on table public.post_participants to authenticated;
grant delete on table public.post_participants to authenticated;

-- The roster is as visible as the idea: a feed card shows the avatar stack
-- and the seat counter, both of which count these rows.
drop policy if exists post_participants_select_signed_in on public.post_participants;
create policy post_participants_select_signed_in on public.post_participants
  for select to anon, authenticated
  using (public.open_read() or public.current_user_id() is not null);

-- "Присоединиться": you add yourself, and only while can_join_post() holds —
-- chat access passes, sign-up is open, a seat is free, and you are not
-- already in. Nobody can add anybody else; the author's own row comes from
-- the trigger in 0007.
drop policy if exists post_participants_insert_self on public.post_participants;
create policy post_participants_insert_self on public.post_participants
  for insert to authenticated
  with check (
    user_id = public.current_user_id()
    and public.can_join_post(post_id, public.current_user_id())
  );

-- Leaving is deleting your own row. "Удалить из чата" is the same delete
-- performed by the author or by a moderator holding can_kick — and the
-- author can never be removed from their own idea.
drop policy if exists post_participants_delete_self_or_kick on public.post_participants;
create policy post_participants_delete_self_or_kick on public.post_participants
  for delete to authenticated
  using (
    user_id = public.current_user_id()
    or (
      public.can_moderate(post_id, public.current_user_id(), 'can_kick')
      and user_id <> public.post_author_id(post_id)
    )
  );

-- No UPDATE: joined_at is a fact, and changing the post or the user of a
-- membership row is just leaving and joining again.

/* ── post_moderators ────────────────────────────────────────────────── */

alter table public.post_moderators enable row level security;

revoke all on table public.post_moderators from anon, authenticated;
grant select on table public.post_moderators to anon, authenticated;
grant insert on table public.post_moderators to authenticated;
grant update (permissions) on table public.post_moderators to authenticated;
grant delete on table public.post_moderators to authenticated;

-- Roles are shown in the participant sheet next to every member.
drop policy if exists post_moderators_select_signed_in on public.post_moderators;
create policy post_moderators_select_signed_in on public.post_moderators
  for select to anon, authenticated
  using (public.open_read() or public.current_user_id() is not null);

-- Only the author appoints moderators, and only from the people already in
-- the chat. The author is never in this table — they hold all four rights
-- implicitly (public.can_moderate).
drop policy if exists post_moderators_insert_author on public.post_moderators;
create policy post_moderators_insert_author on public.post_moderators
  for insert to authenticated
  with check (
    public.is_post_author(post_id, public.current_user_id())
    and public.is_post_member(post_id, user_id)
    and user_id <> public.current_user_id()
  );

drop policy if exists post_moderators_update_author on public.post_moderators;
create policy post_moderators_update_author on public.post_moderators
  for update to authenticated
  using (public.is_post_author(post_id, public.current_user_id()))
  with check (public.is_post_author(post_id, public.current_user_id()));

drop policy if exists post_moderators_delete_author on public.post_moderators;
create policy post_moderators_delete_author on public.post_moderators
  for delete to authenticated
  using (public.is_post_author(post_id, public.current_user_id()));

/* ── messages ───────────────────────────────────────────────────────── */

alter table public.messages enable row level security;

revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to anon, authenticated;
grant insert on table public.messages to authenticated;
grant update (is_pinned) on table public.messages to authenticated;
grant delete on table public.messages to authenticated;

-- Reading the group chat is exactly posts.chat_access: "Все" lets anyone
-- signed in read along, "Только подписчики" and "Только друзья" do not.
-- Everybody who is already in the chat keeps reading it forever, including
-- after the author closes sign-up and after the idea is over.
drop policy if exists messages_select_chat on public.messages;
create policy messages_select_chat on public.messages
  for select to anon, authenticated
  using (
    public.open_read()
    or public.can_enter_post_chat(post_id, public.current_user_id())
  );

-- Writing needs membership, not just access: you join the idea, then you
-- talk. Attaching media additionally needs the can_post_media right, which
-- the author always has and a moderator has per permissions.
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages
  for insert to authenticated
  with check (
    author_id = public.current_user_id()
    and public.is_post_member(post_id, public.current_user_id())
    and (
      media_url is null
      or public.can_moderate(post_id, public.current_user_id(), 'can_post_media')
    )
  );

-- The only updatable column is is_pinned (see the grant above), so this is
-- the "Закрепить" / "Открепить" policy and nothing else.
drop policy if exists messages_update_pin on public.messages;
create policy messages_update_pin on public.messages
  for update to authenticated
  using (public.can_moderate(post_id, public.current_user_id(), 'can_pin'))
  with check (public.can_moderate(post_id, public.current_user_id(), 'can_pin'));

drop policy if exists messages_delete_own_or_author on public.messages;
create policy messages_delete_own_or_author on public.messages
  for delete to authenticated
  using (
    author_id = public.current_user_id()
    or public.is_post_author(post_id, public.current_user_id())
  );

/* ── polls ──────────────────────────────────────────────────────────── */

alter table public.polls enable row level security;

revoke all on table public.polls from anon, authenticated;
grant select on table public.polls to anon, authenticated;
grant insert on table public.polls to authenticated;
grant delete on table public.polls to authenticated;

drop policy if exists polls_select_chat on public.polls;
create policy polls_select_chat on public.polls
  for select to anon, authenticated
  using (
    public.open_read()
    or public.can_enter_post_chat(post_id, public.current_user_id())
  );

-- A голосование is created by the author or by a moderator holding can_poll.
drop policy if exists polls_insert_moderator on public.polls;
create policy polls_insert_moderator on public.polls
  for insert to authenticated
  with check (
    created_by = public.current_user_id()
    and public.is_post_member(post_id, public.current_user_id())
    and public.can_moderate(post_id, public.current_user_id(), 'can_poll')
  );

drop policy if exists polls_delete_own_or_author on public.polls;
create policy polls_delete_own_or_author on public.polls
  for delete to authenticated
  using (
    created_by = public.current_user_id()
    or public.is_post_author(post_id, public.current_user_id())
  );

-- No UPDATE policy and no UPDATE grant: options are index-aligned with
-- poll_votes.option_index (0005), so editing a poll would silently move
-- everybody's vote. Delete it and make a new one.

/* ── poll_votes ─────────────────────────────────────────────────────── */

alter table public.poll_votes enable row level security;

revoke all on table public.poll_votes from anon, authenticated;
grant select on table public.poll_votes to anon, authenticated;
grant insert on table public.poll_votes to authenticated;
grant update (option_index) on table public.poll_votes to authenticated;
grant delete on table public.poll_votes to authenticated;

-- Results are public inside the chat — the same audience that may read the
-- poll may count the votes.
drop policy if exists poll_votes_select_chat on public.poll_votes;
create policy poll_votes_select_chat on public.poll_votes
  for select to anon, authenticated
  using (
    public.open_read()
    or public.can_enter_post_chat(public.poll_post_id(poll_id), public.current_user_id())
  );

drop policy if exists poll_votes_insert_member on public.poll_votes;
create policy poll_votes_insert_member on public.poll_votes
  for insert to authenticated
  with check (
    user_id = public.current_user_id()
    and public.is_post_member(public.poll_post_id(poll_id), public.current_user_id())
  );

-- Changing your mind is an UPDATE of option_index on your own row; the
-- unique constraint (poll_id, user_id) makes that the only way.
drop policy if exists poll_votes_update_own on public.poll_votes;
create policy poll_votes_update_own on public.poll_votes
  for update to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

drop policy if exists poll_votes_delete_own on public.poll_votes;
create policy poll_votes_delete_own on public.poll_votes
  for delete to authenticated
  using (user_id = public.current_user_id());

/* ── direct_messages ────────────────────────────────────────────────── */

alter table public.direct_messages enable row level security;

revoke all on table public.direct_messages from anon, authenticated;
grant select on table public.direct_messages to anon, authenticated;
grant insert on table public.direct_messages to authenticated;
grant delete on table public.direct_messages to authenticated;

-- Exactly the two people in the conversation.
drop policy if exists direct_messages_select_own on public.direct_messages;
create policy direct_messages_select_own on public.direct_messages
  for select to anon, authenticated
  using (
    public.open_read()
    or sender_id = public.current_user_id()
    or receiver_id = public.current_user_id()
  );

-- "Написать" follows the recipient's privacy_settings.who_can_message:
-- everyone, friends (mutual follow) or nobody. Unfollowing therefore closes
-- the conversation for a 'friends' recipient immediately.
drop policy if exists direct_messages_insert_allowed on public.direct_messages;
create policy direct_messages_insert_allowed on public.direct_messages
  for insert to authenticated
  with check (
    sender_id = public.current_user_id()
    and public.can_message_user(receiver_id, public.current_user_id())
  );

-- You may take back what you sent. Nobody can delete out of somebody else's
-- conversation, and there is no UPDATE: a sent message is not editable.
drop policy if exists direct_messages_delete_sender on public.direct_messages;
create policy direct_messages_delete_sender on public.direct_messages
  for delete to authenticated
  using (sender_id = public.current_user_id());

/* ── follows ────────────────────────────────────────────────────────── */

alter table public.follows enable row level security;

revoke all on table public.follows from anon, authenticated;
grant select on table public.follows to anon, authenticated;
grant insert on table public.follows to authenticated;
grant delete on table public.follows to authenticated;

-- "Подписчики" and "Подписки" are open lists, and the follow graph is what
-- the "Подписки" feed tab is built on.
drop policy if exists follows_select_signed_in on public.follows;
create policy follows_select_signed_in on public.follows
  for select to anon, authenticated
  using (public.open_read() or public.current_user_id() is not null);

drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows
  for insert to authenticated
  with check (follower_id = public.current_user_id());

-- Unfollowing is deleting your own edge. Removing a follower is not a
-- feature of this product, so the followed person cannot delete the row.
drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows
  for delete to authenticated
  using (follower_id = public.current_user_id());

/* ── notifications ──────────────────────────────────────────────────── */

alter table public.notifications enable row level security;

revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to anon, authenticated;
grant update (is_read) on table public.notifications to authenticated;
grant delete on table public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to anon, authenticated
  using (public.open_read() or user_id = public.current_user_id());

-- The only thing a recipient does to a notification is read it.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = public.current_user_id());

-- No INSERT policy and no INSERT grant: rows come from the triggers in 0007,
-- which run as definer and are the only writer. A client that could insert
-- here could forge "кто-то присоединился".
