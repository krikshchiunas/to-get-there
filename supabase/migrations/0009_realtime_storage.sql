-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0009_realtime_storage.sql — live updates and file buckets            ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Realtime and Storage are both governed by the policies in 0008: a realtime
-- subscription only delivers rows the subscriber may SELECT, and
-- storage.objects gets its own policies below, written against the same
-- functions from 0007. Nothing here grants a client anything it could not
-- already read through PostgREST.

/* ── realtime ───────────────────────────────────────────────────────── */

-- The five tables a screen has to see change while it is open:
--
--   messages           the idea chat, the reason the product exists
--   direct_messages    one-to-one conversation
--   poll_votes         a голосование tally moving while people vote
--   post_participants  somebody joins or is removed → seat counter, roster
--   notifications      the badge in the bottom navigation
--
-- posts and users are deliberately not in the publication: the feed is a
-- timetable, not a live ticker, and a card that rearranges itself under the
-- thumb is worse than one that is a minute old.
--
-- Written as a loop because `alter publication … add table` fails if the
-- table is already a member, and `supabase db reset` replays this file.
do $$
declare
  target text;
  targets text[] := array[
    'messages',
    'direct_messages',
    'poll_votes',
    'post_participants',
    'notifications'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;

  foreach target in array targets loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end
$$;

-- A DELETE event carries only the replica identity. The two tables whose
-- deletes the UI has to act on are memberships ("Удалить из чата" has to
-- remove the row from an open participant sheet) and votes (taking a vote
-- back has to move the tally), so both send the whole old row.
alter table public.post_participants replica identity full;
alter table public.poll_votes replica identity full;

comment on table public.post_participants is
  'lib/types.ts → PostParticipant. Membership of an idea chat. Includes the author. In the supabase_realtime publication with replica identity full (0009).';

/* ── storage buckets ────────────────────────────────────────────────── */

-- Three buckets, three different audiences:
--
--   avatars       public read. An avatar is shown on every card, so making
--                 the object public is what lets Next.js <Image> cache it
--                 (next.config.ts already allows the Supabase host).
--                 Path: <users.id>/<file>
--   post-media    read by whoever may enter that idea's chat.
--                 Path: <posts.id>/<file>
--   verification  the documents behind "Личность подтверждена". Owner and
--                 service role only, never public, never listed.
--                 Path: <users.id>/<file>
--
-- The first path segment is the owning entity in all three, which is what
-- the policies below check with storage.foldername(name).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    2 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'post-media',
    'post-media',
    false,
    10 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
  ),
  (
    'verification',
    'verification',
    false,
    10 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* ── storage policies ───────────────────────────────────────────────── */

-- Already enabled in every Supabase deployment; written out for a
-- self-hosted stack. `storage.objects` is owned by supabase_storage_admin, so
-- the statement is wrapped: creating policies on the table is the supported
-- path and works through role membership, while flipping a switch that is
-- already on must not be able to fail a migration.
do $$
begin
  alter table storage.objects enable row level security;
exception
  when insufficient_privilege then
    raise notice 'storage.objects: RLS left as it is (no ownership) — it is enabled by default';
end
$$;

-- avatars ------------------------------------------------------------------

-- Public read: the bucket is public, and this policy makes the same thing
-- true through the API for a signed-out visitor.
drop policy if exists avatars_read_all on storage.objects;
create policy avatars_read_all on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

-- post-media ---------------------------------------------------------------

-- Same audience as the chat the file was posted in. try_uuid() (0007) turns
-- a folder name that is not a uuid into NULL, and can_enter_post_chat(NULL,
-- …) is false, so a hand-written path denies instead of erroring.
drop policy if exists post_media_read_chat on storage.objects;
create policy post_media_read_chat on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-media'
    and public.can_enter_post_chat(
      public.try_uuid((storage.foldername(name))[1]),
      public.current_user_id()
    )
  );

-- Uploading mirrors the media rule on public.messages (0008): the author
-- always, a moderator holding can_post_media.
drop policy if exists post_media_insert_moderator on storage.objects;
create policy post_media_insert_moderator on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and public.can_moderate(
      public.try_uuid((storage.foldername(name))[1]),
      public.current_user_id(),
      'can_post_media'
    )
  );

drop policy if exists post_media_delete_own_or_author on storage.objects;
create policy post_media_delete_own_or_author on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (
      owner = auth.uid()
      or public.is_post_author(
        public.try_uuid((storage.foldername(name))[1]),
        public.current_user_id()
      )
    )
  );

-- verification -------------------------------------------------------------

-- Nobody but the person themselves, and the service role that reviews the
-- submission (it bypasses RLS). No update policy: a new attempt is a new
-- file, so a reviewed document can never be swapped underneath the review.
drop policy if exists verification_read_own on storage.objects;
create policy verification_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

drop policy if exists verification_insert_own on storage.objects;
create policy verification_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

drop policy if exists verification_delete_own on storage.objects;
create policy verification_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'verification'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

-- Note on `storage.buckets`: no policy is added there on purpose. Clients do
-- not need to list buckets — they address them by the three names above —
-- and leaving it closed keeps the bucket inventory out of the API.
