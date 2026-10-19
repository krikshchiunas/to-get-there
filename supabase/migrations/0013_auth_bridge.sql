-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0013 — регистрация: auth.users -> public.users                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Строка в auth.users — это аккаунт. Строка в public.users — человек в
-- продукте. Триггер создаёт второе из первого и отказывает в регистрации,
-- если домен адреса не числится в public.universities. Это и есть проверка
-- университетской почты — там, где её нельзя обойти формой.
--
-- Список исключений email_allowlist — для владельца продукта и
-- тестировщиков без университетской почты. Адреса туда вносятся вручную
-- (`insert into public.email_allowlist ...`) и в репозиторий не попадают.

create table if not exists public.email_allowlist (
  email          text primary key,
  university_id  uuid not null references public.universities (id) on delete restrict,
  note           text,
  created_at     timestamptz not null default now(),

  constraint email_allowlist_lower check (email = lower(btrim(email))),
  constraint email_allowlist_shape check (email ~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$')
);

comment on table public.email_allowlist is
  'Адреса, которым разрешена регистрация в обход проверки домена университета. Проверить перед запуском и вычистить лишнее.';

alter table public.email_allowlist enable row level security;
revoke all on table public.email_allowlist from anon, authenticated;
-- Политик нет: таблицу читает только триггер с security definer.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  address      text;
  mail_domain  text;
  university   uuid;
  base         text;
  candidate    text;
  attempt      integer := 0;
begin
  address := lower(btrim(coalesce(new.email, '')));

  if position('@' in address) = 0 then
    raise exception 'Регистрация возможна только по адресу университетской почты'
      using errcode = 'check_violation';
  end if;

  mail_domain := split_part(address, '@', 2);

  -- Сначала точное совпадение по списку исключений, потом домен.
  select a.university_id into university
  from public.email_allowlist a
  where a.email = address;

  if university is null then
    select u.id into university
    from public.universities u
    where u.domain = mail_domain;
  end if;

  if university is null then
    raise exception 'Домен % не относится ни к одному университету из списка', mail_domain
      using errcode = 'check_violation',
            hint = 'Добавьте университет в public.universities или используйте другой адрес';
  end if;

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
    candidate := left(base, 15) || substr(
      encode(extensions.digest(address || attempt::text, 'sha256'), 'hex'), 1, 4
    );
  end loop;

  -- is_verified здесь не ставится: верификация личности — отдельный шаг.
  insert into public.users (auth_user_id, nickname, university_id)
  values (new.id, candidate, university);

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Создаёт public.users для нового аккаунта и требует университетский домен либо адрес из email_allowlist.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
