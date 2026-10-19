-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ auth_bridge.sql — auth.users → public.users                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
--                    ПРИМЕНЯТЬ НА ФИНАЛЬНОМ ЭТАПЕ, НЕ СЕЙЧАС.
--
-- This file is NOT a migration and must never be moved into
-- supabase/migrations. It is stage 6 of docs/ROADMAP.md — registration —
-- and applying it earlier changes the rules the whole project currently
-- runs on:
--
--   * Every seeded profile has auth_user_id = NULL and nobody can sign in
--     as one. With this trigger in place, a sign-up creates a *new* profile
--     instead, so mara_t stops being the person the screens render for.
--   * public.current_user_id() starts returning a value, which turns every
--     policy in 0008 from "open_read decides" into "the viewer decides".
--
-- Apply it when the sign-up and sign-in screens exist, in this order:
--
--   1. psql -f supabase/later/auth_bridge.sql   (or paste into the SQL editor)
--   2. update public.app_flags set open_read = false, updated_at = now();
--   3. re-seed or hand the existing profiles their auth_user_id
--
-- Step 2 is the one that matters: until the flag is false the database is
-- still in development read mode (see 0007).

/* ── what the bridge does ───────────────────────────────────────────── */

-- A row in auth.users is an account. A row in public.users is a person in
-- the product. This trigger creates the second from the first and refuses
-- the whole sign-up when the address does not belong to a university in
-- public.universities — which is the entire university-mail check, enforced
-- where it cannot be bypassed rather than in a form.
--
-- The nickname is derived from the local part of the address, trimmed to the
-- shape users_nickname_fmt demands (0003: ^[a-z0-9][a-z0-9._]{2,23}$) and
-- made unique with a short hash suffix. It is also the /u/<nickname> URL
-- segment, so it is lower case from the first second.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  address       text;
  mail_domain   text;
  university    uuid;
  base          text;
  candidate     text;
  attempt       integer := 0;
begin
  address := lower(btrim(coalesce(new.email, '')));

  if position('@' in address) = 0 then
    raise exception 'Регистрация возможна только по адресу университетской почты'
      using errcode = 'check_violation';
  end if;

  mail_domain := split_part(address, '@', 2);

  select u.id into university
  from public.universities u
  where u.domain = mail_domain;

  if university is null then
    raise exception 'Домен % не относится ни к одному университету из списка', mail_domain
      using errcode = 'check_violation',
            hint = 'Добавьте университет в public.universities или используйте другой адрес';
  end if;

  -- Local part → nickname: keep [a-z0-9._], make sure it starts with a
  -- letter or digit, keep room for a four-character suffix.
  base := regexp_replace(split_part(address, '@', 1), '[^a-z0-9._]', '', 'g');
  base := regexp_replace(base, '^[^a-z0-9]+', '');
  base := left(base, 19);

  if char_length(base) < 3 then
    base := rpad(base, 3, 'x');
  end if;

  candidate := base;

  while exists (select 1 from public.users u where u.nickname = candidate) loop
    attempt := attempt + 1;

    if attempt > 20 then
      raise exception 'Не удалось подобрать свободный ник для %', address
        using errcode = 'unique_violation';
    end if;

    -- pgcrypto lives in the `extensions` schema (0001).
    candidate := left(base, 15) || substr(
      encode(extensions.digest(address || attempt::text, 'sha256'), 'hex'), 1, 4
    );
  end loop;

  -- is_verified is not set here and cannot be: identity verification is a
  -- separate, reviewed step (the Верификация screen), and the guard trigger
  -- in 0007 would reset it anyway.
  insert into public.users (auth_user_id, nickname, university_id)
  values (new.id, candidate, university);

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Stage 6 only: creates the public.users row for a new account and enforces the university-mail rule against universities.domain.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

revoke execute on function public.handle_new_auth_user() from public;

/* ── linking the profiles that already exist ────────────────────────── */

-- The seeded people have no account. Three ways to deal with them, pick one
-- when the time comes:
--
--   a) keep them as they are — they stay visible and nobody can sign in as
--      them, which is fine for a demo database;
--   b) claim one by hand after signing up with a university address:
--
--        -- the sign-up created a fresh profile; delete it and take mara_t
--        delete from public.users
--         where auth_user_id = '<new auth.users.id>';
--
--        update public.users
--           set auth_user_id = '<new auth.users.id>'
--         where nickname = 'mara_t';
--
--   c) start clean: truncate the dataset and let real sign-ups fill it.
--
-- Option (b) has to delete first — users.auth_user_id is unique.

/* ── rolling it back ────────────────────────────────────────────────── */

-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_auth_user();
-- update public.app_flags set open_read = true, updated_at = now();
