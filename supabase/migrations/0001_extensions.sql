-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0001_extensions.sql — extensions and conventions                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- To Get There: ideas with a time, a place and a number of seats. Someone
-- writes what they want to do, everyone else enters that idea's group chat.
--
-- Conventions that hold for every migration in this folder:
--
--   * Every primary key is `uuid` with `default gen_random_uuid()`.
--     gen_random_uuid() is core Postgres since 13 (pg_catalog), so it needs
--     no extension and no schema qualification.
--   * Every timestamp is `timestamptz`, written by `now()`, read in the
--     app's Europe/Berlin wall clock (lib/format.ts does the formatting).
--   * Extensions live in the `extensions` schema, never in `public`, and are
--     referenced schema-qualified (`extensions.gin_trgm_ops`) so nothing
--     depends on the session's search_path.
--   * Every function is `set search_path = ''` and fully qualifies its
--     references. pg_catalog is always implicitly in scope.
--
-- Order: 0001 extensions, 0002 reference data + enums, 0003 users,
-- 0004 posts, 0005 chat, 0006 social, 0007 views/functions/triggers,
-- 0008 RLS, 0009 realtime + storage. Then supabase/seed.sql.

create schema if not exists extensions;

-- Digest/crypto helpers. Not needed for uuids (see above) but the auth
-- bridge in supabase/later/auth_bridge.sql uses it for nickname suffixes.
create extension if not exists pgcrypto with schema extensions;

-- Trigram search. The search screen matches a needle against title,
-- description, city, address, category and nickname with a plain substring
-- match (lib/mock/index.ts → searchPosts); `ilike '%needle%'` over a GIN
-- trigram index is the direct translation of that.
create extension if not exists pg_trgm with schema extensions;

comment on schema extensions is
  'Postgres extensions. Never install into public — PostgREST exposes public.';
