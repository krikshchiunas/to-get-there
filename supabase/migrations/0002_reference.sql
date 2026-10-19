-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0002_reference.sql — domain enums, universities, categories          ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- The enums mirror the string unions in lib/types.ts one to one. Adding a
-- value here means adding it there in the same commit, otherwise the row
-- types stop matching the schema.

/* ── enums ──────────────────────────────────────────────────────────── */

-- lib/types.ts → ChatAccess. Who may enter the group chat of an idea.
-- 'followers' = people who follow the author, 'friends' = mutual follow.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'chat_access') then
    create type public.chat_access as enum ('everyone', 'followers', 'friends');
  end if;
end
$$;

-- lib/types.ts → GeoMode. How the author pinned the location down.
-- 'radius' carries a geo_radius_m, 'area' an address, 'city' only the city.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'geo_mode') then
    create type public.geo_mode as enum ('radius', 'area', 'city');
  end if;
end
$$;

-- lib/types.ts → NotificationType.
-- 'new_message' covers a new message in an idea chat. Direct messages do not
-- create notification rows (see docs/DATABASE.md, "Notifications").
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'new_participant',
      'new_message',
      'new_follower',
      'new_post_from_following',
      'event_reminder'
    );
  end if;
end
$$;

comment on type public.chat_access is 'lib/types.ts → ChatAccess';
comment on type public.geo_mode is 'lib/types.ts → GeoMode';
comment on type public.notification_type is 'lib/types.ts → NotificationType';

/* ── universities ───────────────────────────────────────────────────── */

-- Reference data, world readable, written by migrations and the service role
-- only. `domain` is the email domain the registration step verifies against
-- (supabase/later/auth_bridge.sql).
create table if not exists public.universities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domain      text not null,
  city        text not null,
  country     text not null default 'Deutschland',
  short_name  text not null,

  constraint universities_name_len   check (char_length(btrim(name)) between 2 and 160),
  constraint universities_domain_fmt check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  constraint universities_city_len   check (char_length(btrim(city)) between 2 and 80),
  constraint universities_short_len  check (char_length(btrim(short_name)) between 2 and 40)
);

create unique index if not exists universities_domain_key on public.universities (domain);
create index if not exists universities_city_idx on public.universities (city);

comment on table public.universities is
  'lib/types.ts → University. Reference data; see supabase/seed.sql for the eight seeded ones.';
comment on column public.universities.domain is
  'Email domain for the university-email check at registration, e.g. tu-berlin.de.';
comment on column public.universities.short_name is
  'Shown on cards where the full name will not fit, e.g. "TU Berlin".';

/* ── categories ─────────────────────────────────────────────────────── */

-- `is_main` categories are offered up front when creating a post or
-- filtering; the rest sit behind "Mehr" (lib/mock/categories.ts).
create table if not exists public.categories (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  is_main  boolean not null default false,
  icon     text not null,

  constraint categories_name_len check (char_length(btrim(name)) between 2 and 40),
  constraint categories_icon_fmt check (icon ~ '^[a-z][a-z-]{1,23}$')
);

create unique index if not exists categories_name_key on public.categories (lower(name));
create index if not exists categories_main_idx on public.categories (is_main, name);

comment on table public.categories is
  'lib/types.ts → Category. Reference data; twenty rows in supabase/seed.sql.';
comment on column public.categories.icon is
  'Key into IconName in lib/types.ts, rendered by components/ui/icon.tsx. Kept as text so the icon set can grow without a migration.';
