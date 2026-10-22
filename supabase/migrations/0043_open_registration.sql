-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0043 — открытая регистрация, профиль без пропусков, лимиты входа     ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Решение продукта для MVP: регистрация по почте и паролю открыта всем.
-- Партнёрств с вузами пока нет, поэтому домен почты больше не пропуск.
--
--   1. Вуз в профиле и в идее — необязательный. Если домен почты совпал с
--      вузом из справочника (или адрес есть в email_allowlist), вуз
--      подставляется, как и раньше: человек подтвердил, что владеет этим
--      ящиком, — значит, «мой вуз» в настройках приватности по-прежнему
--      означает проверенный вуз. Остальные — без вуза. Выбрать вуз вручную
--      нельзя: иначе любой назвался бы студентом TU Berlin и увидел профили
--      «только для моего вуза».
--   2. Профиль создаёт одна функция — private.create_profile_for(). Её зовёт
--      триггер на auth.users (в той же транзакции, что и аккаунт) и
--      ensure_my_profile() — самовосстановление, если строка users когда-то
--      пропала. Повторный вызов ничего не ломает.
--   3. Профиль больше не удалить мимо удаления аккаунта: иначе оставался
--      вход без профиля, и приложение гоняло человека по кругу редиректов.
--   4. Лимиты попыток входа, регистрации, сброса и повторного письма — в
--      Postgres, общие для всех серверов. GoTrue считает свои лимиты по
--      IP, а запросы к нему идут с серверов приложения — его лимиты общие
--      на всех людей сразу.
--
-- Только расширение: колонки становятся необязательными, старое
-- приложение с ними работает. Порядок выкатки — docs/AUTH.md.

/* ── 1. вуз — необязательный ───────────────────────────────────────── */

alter table public.users alter column university_id drop not null;
alter table public.posts alter column university_id drop not null;

comment on column public.users.university_id is
  'Вуз по домену подтверждённой почты (или email_allowlist). null — без вуза. Не правится клиентом (0008).';
comment on column public.posts.university_id is
  'Вуз автора на момент создания (posts_set_university). null — у автора нет вуза.';

-- Идея по-прежнему берёт вуз автора; без профиля автора идеи не бывает.
create or replace function public.posts_set_university()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_university uuid;
  author_exists boolean;
begin
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;
    new.created_at := old.created_at;
  end if;

  select true, u.university_id
    into author_exists, author_university
  from public.users u
  where u.id = new.author_id;

  if not coalesce(author_exists, false) then
    raise exception 'post %: author % has no profile row', coalesce(new.id::text, 'new'), new.author_id
      using errcode = 'foreign_key_violation';
  end if;

  new.university_id := author_university;
  return new;
end;
$$;

-- Карточки идей — и для идей без вуза.
create or replace view public.post_cards
  with (security_invoker = true)
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
  case
    when p.max_participants is null then null
    else greatest(0, p.max_participants - coalesce(pc.participant_count, 0))::integer
  end as seats_left,

  (not p.is_closed and p.date_start + interval '1 hour' > now()) as in_feed
from public.posts p
cross join lateral private.author_card(p.author_id) a
left join public.universities un on un.id = p.university_id
join public.categories c on c.id = p.category_id
left join (
  select pp.post_id, count(*) as participant_count
  from public.post_participants pp
  group by pp.post_id
) pc on pc.post_id = p.id;

/* ── 2. профиль: одна функция, повторный вызов безопасен ───────────── */

create or replace function private.create_profile_for(account uuid, address text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  mail        text := lower(btrim(coalesce(address, '')));
  university  uuid;
  base        text;
  candidate   text;
  attempt     integer := 0;
  profile     uuid;
begin
  if account is null then
    raise exception 'create_profile_for: account is required' using errcode = '22004';
  end if;

  select u.id into profile from public.users u where u.auth_user_id = account;
  if profile is not null then
    return profile;
  end if;

  -- Вуз — по точному адресу из списка исключений, потом по домену. Не
  -- нашёлся — профиль без вуза, регистрация от этого не зависит.
  select a.university_id into university from public.email_allowlist a where a.email = mail;
  if university is null and position('@' in mail) > 0 then
    select un.id into university from public.universities un where un.domain = split_part(mail, '@', 2);
  end if;

  -- Ник из адреса: [a-z0-9._], с буквы или цифры, 3–24 символа.
  base := regexp_replace(split_part(mail, '@', 1), '[^a-z0-9._]', '', 'g');
  base := regexp_replace(base, '^[^a-z0-9]+', '');
  base := left(base, 19);
  if char_length(base) < 3 then
    base := rpad(coalesce(nullif(base, ''), 'u'), 3, 'x');
  end if;
  candidate := base;

  loop
    begin
      insert into public.users (auth_user_id, nickname, university_id)
      values (account, candidate, university)
      returning id into profile;
      return profile;
    exception when unique_violation then
      -- Тот же аккаунт уже создан параллельным вызовом — вернуть его.
      select u.id into profile from public.users u where u.auth_user_id = account;
      if profile is not null then
        return profile;
      end if;
      -- Ник занят — суффикс; после двадцати попыток — случайный хвост.
      attempt := attempt + 1;
      if attempt > 40 then
        raise;
      elsif attempt <= 20 then
        candidate := left(base, 15) || substr(md5(account::text || attempt::text), 1, 4);
      else
        candidate := left(base, 11) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
      end if;
    end;
  end loop;
end;
$$;

comment on function private.create_profile_for(uuid, text) is
  'Профиль для аккаунта Supabase Auth: ник из адреса, вуз по домену (необязательно). Повторный вызов возвращает существующий.';

revoke all on function private.create_profile_for(uuid, text) from public, anon, authenticated;

-- Триггер регистрации больше никому не отказывает.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.create_profile_for(new.id, new.email);
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Создаёт public.users для нового аккаунта в той же транзакции (private.create_profile_for).';

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

comment on table public.email_allowlist is
  'Адреса, которым вуз назначается вручную (тестировщики, сотрудники). Регистрацию не ограничивает (0043).';

-- Самовосстановление: вошёл, а профиля нет — создать. Только для себя.
create or replace function private.ensure_profile_of_caller()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account uuid := auth.uid();
  mail    text;
begin
  if account is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select u.email into mail from auth.users u where u.id = account;
  if not found then
    raise exception 'no such account' using errcode = '42501';
  end if;

  return private.create_profile_for(account, mail);
end;
$$;

revoke all on function private.ensure_profile_of_caller() from public, anon;
grant execute on function private.ensure_profile_of_caller() to authenticated;

create or replace function public.ensure_my_profile()
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.ensure_profile_of_caller();
$$;

revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

/* ── 3. профиль удаляется только вместе с аккаунтом ────────────────── */

-- delete_my_account() (0035) удаляет auth.users, каскад уносит профиль.
-- Прямое удаление строки users через API оставляло вход без профиля.
drop policy if exists users_delete_own on public.users;
revoke delete on table public.users from authenticated;

/* ── 4. лимиты попыток входа — общие для всех серверов ─────────────── */

create table if not exists private.auth_attempts (
  id          bigint generated always as identity primary key,
  operation   text not null,
  bucket      text not null,
  created_at  timestamptz not null default now(),

  constraint auth_attempts_operation check (
    operation in ('sign_in', 'sign_up', 'password_reset', 'resend_confirmation')
  ),
  constraint auth_attempts_bucket check (char_length(bucket) between 3 and 160)
);

create index if not exists auth_attempts_lookup_idx
  on private.auth_attempts (operation, bucket, created_at desc);

comment on table private.auth_attempts is
  'Попытки входа, регистрации, сброса и повторного письма. Ключи — HMAC от IP и почты, не сами значения. Хранятся сутки.';

revoke all on table private.auth_attempts from public, anon, authenticated;

-- Можно ли ещё одну попытку. 0 — можно, попытка записана; иначе — через
-- сколько секунд. Ключи приходят уже хешированными (lib/auth/rate-limit.ts):
-- ни IP, ни почта сюда не попадают. Пределы — здесь, в одном месте. Нет
-- одного из ключей — пропускаются только правила, которым он нужен.
create or replace function public.auth_attempt(operation text, ip_key text, email_key text default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  rule        record;
  key         text;
  used        integer;
  oldest      timestamptz;
  wait        integer := 0;
  buckets     text[] := '{}';
begin
  if operation not in ('sign_in', 'sign_up', 'password_reset', 'resend_confirmation') then
    raise exception 'unknown operation %', operation using errcode = '22023';
  end if;

  for rule in
    select * from (values
      -- операция              ключ        попыток окно
      ('sign_in',              'ip',       60,     interval '10 minutes'),
      ('sign_in',              'ip_email', 10,     interval '15 minutes'),
      ('sign_in',              'email',    50,     interval '1 hour'),
      ('sign_up',              'ip',       10,     interval '1 hour'),
      ('password_reset',       'ip',       20,     interval '1 hour'),
      ('password_reset',       'email',     5,     interval '1 hour'),
      ('resend_confirmation',  'ip',       20,     interval '1 hour'),
      ('resend_confirmation',  'email',     5,     interval '1 hour')
    ) as r(op, kind, max_attempts, span)
    where r.op = auth_attempt.operation
  loop
    -- || с null даёт null: правило без нужного ключа просто пропускается.
    key := case rule.kind
      when 'ip'       then 'ip:' || ip_key
      when 'email'    then 'email:' || email_key
      when 'ip_email' then 'ip_email:' || ip_key || ':' || email_key
    end;
    continue when key is null;

    -- Параллельные попытки с одного ключа — по очереди: иначе две сразу
    -- проскочили бы последний свободный слот.
    perform pg_advisory_xact_lock(hashtextextended(auth_attempt.operation || '|' || key, 43));

    select count(*), min(a.created_at)
      into used, oldest
    from private.auth_attempts a
    where a.operation = auth_attempt.operation
      and a.bucket = key
      and a.created_at > now() - rule.span;

    if used >= rule.max_attempts then
      wait := greatest(wait, ceil(extract(epoch from (oldest + rule.span - now())))::integer, 1);
    else
      buckets := buckets || key;
    end if;
  end loop;

  if wait > 0 then
    return wait;
  end if;

  insert into private.auth_attempts (operation, bucket)
  select auth_attempt.operation, b from unnest(buckets) as b;
  return 0;
end;
$$;

comment on function public.auth_attempt(text, text, text) is
  'Лимит попыток входа/регистрации/сброса/повторного письма. Только service_role (сервер приложения).';

revoke all on function public.auth_attempt(text, text, text) from public, anon, authenticated;
grant execute on function public.auth_attempt(text, text, text) to service_role;

-- Старше суток не нужны ни одному окну.
select cron.unschedule(jobid) from cron.job where jobname = 'tgt-purge-auth-attempts';
select cron.schedule(
  'tgt-purge-auth-attempts', '7 * * * *',
  $$delete from private.auth_attempts where created_at < now() - interval '1 day'$$
);
