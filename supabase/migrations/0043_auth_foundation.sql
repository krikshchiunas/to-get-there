-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0043 — фундамент входа: политика регистрации, живые сессии, профиль  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Шаг expand. Поведение регистрации не меняется: режим остаётся
-- 'university', как в 0013, поэтому уже выкаченное приложение работает с
-- этой схемой без правок. Открывает регистрацию 0044 — его применять после
-- выкатки приложения, которое умеет показывать человека без вуза
-- (docs/STAGING.md, «Ломающее — в два шага»).
--
--   1. Кому можно регистрироваться — одна таблица-переключатель и одна
--      функция private.signup_allowed(). Сейчас режимы 'open' и
--      'university'; проверка членства в организации (organization_members,
--      приглашения) встанет туда же, не трогая ни Supabase Auth, ни
--      users.id, ни политики. Решает база: /auth/v1/signup открыт
--      напрямую, и проверка в приложении была бы декорацией.
--   2. Университет у профиля необязателен: его ставит только проверяемый
--      путь (домен почты или email_allowlist), а не выбор в форме. Поэтому
--      правило «профиль видят только студенты моего вуза» по-прежнему
--      нельзя обойти, назвавшись чужим вузом.
--   3. Ник новому человеку — случайный, а не локальная часть почты: ник
--      публичен (/u/<ник>, поиск), а «ivan.petrov.1999» из
--      ivan.petrov.1999@gmail.com — это и утечка адреса, и ответ на вопрос
--      «зарегистрирован ли этот человек».
--   4. Профиль не исчезает отдельно от аккаунта: удалить строку users через
--      API больше нельзя (раньше это оставляло аккаунт без профиля и
--      приложение в петле редиректов). Удаление — только delete_my_account().
--      На случай, если профиля всё же нет, — ensure_my_profile().
--   5. current_user_id() признаёт только живую сессию. PostgREST проверяет
--      у JWT подпись и срок, но не то, что сессия ещё существует: после
--      выхода на всех устройствах или смены пароля старый access-токен
--      читал данные до часа. Теперь отозванная сессия — это «не вошёл» во
--      всех политиках сразу.
--   6. Повторный ввод пароля (смена пароля, удаление аккаунта) — не больше
--      пяти попыток за 15 минут на аккаунт: иначе украденная сессия могла
--      бы подбирать пароль через эти формы.

/* ── 1. политика регистрации ───────────────────────────────────────── */

create table if not exists private.registration_policy (
  singleton   boolean primary key default true,
  mode        text not null,
  updated_at  timestamptz not null default now(),

  constraint registration_policy_single check (singleton),
  constraint registration_policy_mode check (mode in ('open', 'university'))
);

comment on table private.registration_policy is
  'Одна строка: кто может создать аккаунт. open — любой подтверждённый адрес; university — домен из universities или адрес из email_allowlist. Меняется миграцией.';

alter table private.registration_policy enable row level security;
revoke all on table private.registration_policy from public, anon, authenticated;

insert into private.registration_policy (singleton, mode)
values (true, 'university')
on conflict (singleton) do nothing;

-- Вуз, к которому адрес относится проверяемо: сначала точный адрес из
-- списка исключений, потом домен. NULL — ни к какому.
create or replace function private.university_for_email(address text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (select lower(btrim(coalesce(address, ''))) as value)
  select coalesce(
    (select a.university_id from public.email_allowlist a, normalized n where a.email = n.value),
    (select u.id from public.universities u, normalized n where u.domain = split_part(n.value, '@', 2))
  );
$$;

-- Единственная точка, где решается «можно ли создать аккаунт с этим
-- адресом». Нет строки политики — нельзя (закрыто по умолчанию).
create or replace function private.signup_allowed(address text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case (select p.mode from private.registration_policy p)
      when 'open' then position('@' in coalesce(address, '')) > 1
      when 'university' then private.university_for_email(address) is not null
    end,
    false
  );
$$;

revoke all on function private.university_for_email(text) from public, anon, authenticated;
revoke all on function private.signup_allowed(text) from public;
grant execute on function private.signup_allowed(text) to anon, authenticated, service_role;

-- Для формы регистрации: объяснить отказ до похода в Auth, который на
-- любую ошибку триггера отвечает «Database error saving new user». Защита
-- не здесь, а в триггере ниже. В режиме open ответ всегда «да»; в режиме
-- university он говорит о домене то же, что и так публично (список вузов),
-- и о конкретном адресе — только есть ли он в email_allowlist.
create or replace function public.signup_allowed(email text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.signup_allowed(lower(btrim(coalesce(email, ''))));
$$;

revoke all on function public.signup_allowed(text) from public;
grant execute on function public.signup_allowed(text) to anon, authenticated, service_role;

comment on function public.signup_allowed(text) is
  'Можно ли сейчас создать аккаунт с этим адресом (private.registration_policy). Только подсказка формы; отказывает триггер on_auth_user_created.';

/* ── 2. университет необязателен ───────────────────────────────────── */

alter table public.users alter column university_id drop not null;
alter table public.posts alter column university_id drop not null;

comment on column public.users.university_id is
  'Вуз, подтверждённый почтой (домен или email_allowlist). NULL — вуз не подтверждён: лента «Университет» пуста, профили «только мой вуз» не видны.';
comment on column public.posts.university_id is
  'Вуз автора на момент создания (триггер posts_set_university). NULL — у автора вуз не подтверждён.';

-- Раньше NULL здесь означал «у автора нет профиля». Теперь это разные
-- вещи: профиль обязан быть, вуз — нет.
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

  if not found then
    raise exception 'post %: author % has no profile row', coalesce(new.id::text, 'new'), new.author_id
      using errcode = 'foreign_key_violation';
  end if;

  new.university_id := author_university;
  return new;
end;
$$;

-- Идея автора без вуза остаётся в выборке: только колонки вуза пустые.
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

revoke all on public.post_cards from anon, authenticated;
grant select on public.post_cards to authenticated;

/* ── 3. профиль из аккаунта ────────────────────────────────────────── */

-- Общая для триггера регистрации и ensure_my_profile(): проверка политики,
-- вуз по адресу, случайный ник. Повторный вызов для того же аккаунта
-- отдаёт уже существующий профиль, а не второй.
create or replace function private.create_profile(account uuid, address text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized  text := lower(btrim(coalesce(address, '')));
  university  uuid;
  candidate   text;
  attempt     integer := 0;
  profile     uuid;
begin
  select u.id into profile from public.users u where u.auth_user_id = account;
  if found then
    return profile;
  end if;

  if not private.signup_allowed(normalized) then
    -- Auth покажет это как «Database error saving new user»; форма
    -- объясняет отказ сама через public.signup_allowed().
    raise exception 'registration is not open for this address'
      using errcode = 'P0403';
  end if;

  university := private.university_for_email(normalized);

  -- 8 hex-символов — четыре миллиарда вариантов; повтор почти невозможен,
  -- но цикл не даёт ему превратиться в ошибку регистрации.
  loop
    candidate := 'user' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    exit when not exists (select 1 from public.users u where u.nickname = candidate);
    attempt := attempt + 1;
    if attempt >= 10 then
      raise exception 'could not pick a free nickname' using errcode = 'unique_violation';
    end if;
  end loop;

  -- is_verified здесь не ставится: верификация личности — отдельный шаг.
  insert into public.users (auth_user_id, nickname, university_id)
  values (account, candidate, university)
  on conflict (auth_user_id) do nothing
  returning id into profile;

  if profile is null then
    select u.id into profile from public.users u where u.auth_user_id = account;
  end if;
  return profile;
end;
$$;

revoke all on function private.create_profile(uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.create_profile(new.id, new.email);
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Создаёт public.users для нового аккаунта в той же транзакции; кому можно — решает private.signup_allowed().';

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- Страховка для кода приложения: аккаунт есть, профиля нет (например,
-- аккаунт старше этого моста). Профиль создаётся по тем же правилам, что
-- при регистрации, и только для того, кто вызывает.
create or replace function private.ensure_profile_of_caller()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account  uuid := auth.uid();
  address  text;
begin
  if account is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select u.email into address from auth.users u where u.id = account;
  if not found then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  return private.create_profile(account, address);
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

comment on function public.ensure_my_profile() is
  'users.id вызывающего; создаёт профиль, если аккаунт есть, а профиля нет. Повторный вызов ничего не дублирует.';

/* ── 4. профиль не удаляется в обход аккаунта ──────────────────────── */

drop policy if exists users_delete_own on public.users;
revoke delete on table public.users from authenticated;

/* ── 5. только живая сессия ────────────────────────────────────────── */

-- current_user_id() читает auth.sessions с правами владельца функции. Если
-- у роли, которая применяет миграцию (она же владелец), этого права нет,
-- функция падала бы на каждом запросе. Лучше не применить миграцию вовсе:
-- файл — одна транзакция, и всё выше откатится вместе с ним.
do $$
begin
  if not has_table_privilege(current_user, 'auth.sessions', 'select') then
    raise exception '0043: роль % не читает auth.sessions — current_user_id() не сможет проверять сессии', current_user;
  end if;
end
$$;

-- session_id в JWT ставит Supabase Auth; строка в auth.sessions живёт, пока
-- сессия не отозвана (выход, смена пароля, выход на всех устройствах) и не
-- вышел её срок not_after.
--
-- plpgsql, а не sql, — ради скорости: функцию зовут не только политики
-- через InitPlan, но и помощники построчно (список личных чатов — ~3 300
-- вызовов на 300 строк, supabase/perf). Замер на 10 000 вызовов: прежняя
-- версия без проверки сессии — 120 мс, sql с auth.uid() + auth.jwt() —
-- 380 мс (два разбора JSON и план на каждый вызов), эта — 180 мс.
-- Испорченный sub или session_id — не ошибка запроса, а «не вошёл».
create or replace function private.current_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  me uuid;
begin
  select u.id into me
  from public.users u
  join auth.sessions s on s.user_id = u.auth_user_id
  where u.auth_user_id = (claims ->> 'sub')::uuid
    and s.id = (claims ->> 'session_id')::uuid
    and (s.not_after is null or s.not_after > now());
  return me;
exception
  when invalid_text_representation then
    return null;
end;
$$;

comment on function private.current_user_id() is
  'users.id вошедшего; NULL без входа, без профиля или когда сессия из JWT уже отозвана. Единственный источник личности для RLS.';

-- Единственная политика, которая смотрела на auth.uid() мимо
-- current_user_id(): своё фото в чате удаляет владелец файла — теперь
-- только из живой сессии.
drop policy if exists post_media_delete_own_or_author on storage.objects;
create policy post_media_delete_own_or_author on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (select private.current_user_id()) is not null
    and (
      owner = auth.uid()
      or private.is_post_author(
        private.try_uuid((storage.foldername(name))[1]),
        (select private.current_user_id())
      )
    )
  );

/* ── 6. повторный ввод пароля ──────────────────────────────────────── */

create table if not exists private.reauth_attempts (
  user_id       uuid not null references auth.users (id) on delete cascade,
  attempted_at  timestamptz not null default now()
);

create index if not exists reauth_attempts_user_idx
  on private.reauth_attempts (user_id, attempted_at desc);

comment on table private.reauth_attempts is
  'Попытки подтвердить личность паролем изнутри сессии. Хранятся сутки (purge_expired).';

alter table private.reauth_attempts enable row level security;
revoke all on table private.reauth_attempts from public, anon, authenticated;

create or replace function private.claim_reauth_attempt()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or private.current_user_id() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if (select count(*) from private.reauth_attempts r
      where r.user_id = me and r.attempted_at > now() - interval '15 minutes') >= 5 then
    perform private.rate_limited('reauth');
  end if;

  insert into private.reauth_attempts (user_id) values (me);
end;
$$;

revoke all on function private.claim_reauth_attempt() from public, anon;
grant execute on function private.claim_reauth_attempt() to authenticated;

create or replace function public.claim_reauth_attempt()
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.claim_reauth_attempt();
$$;

revoke all on function public.claim_reauth_attempt() from public, anon;
grant execute on function public.claim_reauth_attempt() to authenticated;

comment on function public.claim_reauth_attempt() is
  'Засчитать попытку ввести пароль изнутри сессии. Шестая за 15 минут — SQLSTATE P0429.';

create or replace function private.purge_expired()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications where is_read and created_at < now() - interval '90 days';
  delete from public.event_reminder_log where sent_at < now() - interval '30 days';
  delete from public.reports where status <> 'open' and coalesce(resolved_at, created_at) < now() - interval '180 days';
  delete from private.reauth_attempts where attempted_at < now() - interval '1 day';
end;
$$;

revoke all on function private.purge_expired() from public, anon, authenticated;
