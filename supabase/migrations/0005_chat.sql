-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0005_chat.sql — idea chat, polls, direct messages                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Two separate conversations exist in this product and they never mix:
--
--   public.messages         the group chat of one post-idea. Who may read
--                           and write is decided by posts.chat_access and
--                           the roster (public.can_enter_post_chat).
--   public.direct_messages  one-to-one. Who may write is decided by the
--                           recipient's privacy_settings.who_can_message.

/* ── messages ───────────────────────────────────────────────────────── */

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.users (id) on delete cascade,
  content    text not null default '',
  media_url  text,

  -- At most one pinned message per post. Kept by trigger
  -- messages_single_pin (0007) and guaranteed by the partial unique index
  -- below.
  is_pinned  boolean not null default false,

  created_at timestamptz not null default now(),

  constraint messages_content_len check (char_length(content) <= 2000),
  constraint messages_not_empty   check (char_length(btrim(content)) > 0 or media_url is not null),
  constraint messages_media_set   check (media_url is null or char_length(btrim(media_url)) > 0)
);

-- The chat screen reads one post's history, oldest to newest, and the chat
-- list reads the single latest message per post.
create index if not exists messages_post_idx on public.messages (post_id, created_at desc);
create index if not exists messages_author_idx on public.messages (author_id, created_at desc);

-- getPinnedMessage(postId) plus the hard guarantee for "one pin per post".
create unique index if not exists messages_single_pin_idx
  on public.messages (post_id)
  where is_pinned;

comment on table public.messages is
  'lib/types.ts → Message. Group chat of one post-idea.';
comment on column public.messages.is_pinned is
  'At most one per post. Writing a new pin clears the old one (trigger messages_single_pin).';

/* ── polls ──────────────────────────────────────────────────────────── */

-- lib/types.ts → PollOption is `{ label: string }` and nothing else. A
-- CHECK may not contain a subquery, so the per-element validation lives in
-- this immutable helper.
create or replace function public.is_poll_options(options jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(options) = 'array'
     and jsonb_array_length(options) between 2 and 6
     and not exists (
       select 1
       from jsonb_array_elements(options) as opt
       where jsonb_typeof(opt) <> 'object'
          or opt - 'label' <> '{}'::jsonb
          or coalesce(jsonb_typeof(opt -> 'label'), '') <> 'string'
          or char_length(btrim(opt ->> 'label')) not between 1 and 60
     );
$$;

comment on function public.is_poll_options(jsonb) is
  'True for a JSON array of 2-6 objects, each exactly { "label": "<1-60 chars>" }. lib/types.ts → PollOption[].';

create table if not exists public.polls (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_by  uuid not null references public.users (id) on delete cascade,
  question    text not null,

  -- [{ "label": "19:00" }, { "label": "19:30" }, ...]. Index-aligned with
  -- the tally the UI shows, so options are never reordered or removed.
  options     jsonb not null,

  created_at  timestamptz not null default now(),

  constraint polls_question_len check (char_length(btrim(question)) between 3 and 140),
  constraint polls_options_ok   check (public.is_poll_options(options))
);

create index if not exists polls_post_idx on public.polls (post_id, created_at desc);
create index if not exists polls_author_idx on public.polls (created_by, created_at desc);

comment on table public.polls is
  'lib/types.ts → Poll. Created by the author or by a moderator holding can_poll.';
comment on column public.polls.options is
  'Append-only, index-aligned with poll_votes.option_index. Never reorder.';

/* ── poll_votes ─────────────────────────────────────────────────────── */

-- One vote per person per poll; changing your mind is an UPDATE of
-- option_index. Results are public to everyone in the chat.
create table if not exists public.poll_votes (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid not null references public.polls (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  option_index  integer not null,

  constraint poll_votes_unique unique (poll_id, user_id),

  -- Upper bound is checked against the poll's option count by trigger
  -- poll_votes_check_option (0007), which a CHECK cannot do.
  constraint poll_votes_index_range check (option_index between 0 and 5)
);

-- The tally: votes per option for one poll.
create index if not exists poll_votes_tally_idx on public.poll_votes (poll_id, option_index);
create index if not exists poll_votes_user_idx on public.poll_votes (user_id);

comment on table public.poll_votes is
  'lib/types.ts → PollVote. option_index is a subscript into polls.options.';

/* ── direct_messages ────────────────────────────────────────────────── */

create table if not exists public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.users (id) on delete cascade,
  receiver_id  uuid not null references public.users (id) on delete cascade,
  content      text not null default '',
  media_url    text,
  created_at   timestamptz not null default now(),

  -- Both directions of one conversation share a key, so the thread is a
  -- single index range scan instead of an OR over two columns.
  -- getThread(partnerId) → where conversation_key = <key> order by created_at.
  conversation_key text generated always as (
    least(sender_id::text, receiver_id::text) || ':' || greatest(sender_id::text, receiver_id::text)
  ) stored,

  constraint direct_messages_not_self  check (sender_id <> receiver_id),
  constraint direct_messages_len       check (char_length(content) <= 2000),
  constraint direct_messages_not_empty check (char_length(btrim(content)) > 0 or media_url is not null),
  constraint direct_messages_media_set check (media_url is null or char_length(btrim(media_url)) > 0)
);

create index if not exists direct_messages_conversation_idx
  on public.direct_messages (conversation_key, created_at desc);

-- The chat list reads the latest message per partner from the viewer's side.
create index if not exists direct_messages_receiver_idx
  on public.direct_messages (receiver_id, created_at desc);
create index if not exists direct_messages_sender_idx
  on public.direct_messages (sender_id, created_at desc);

comment on table public.direct_messages is
  'lib/types.ts → DirectMessage. One-to-one conversation, keyed by conversation_key.';
comment on column public.direct_messages.conversation_key is
  'least(sender,receiver) || '':'' || greatest(sender,receiver). Stored and indexed; the same value for both directions.';

revoke execute on function public.is_poll_options(jsonb) from public;
grant execute on function public.is_poll_options(jsonb) to anon, authenticated, service_role;
