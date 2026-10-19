-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0020 — верификация личности через Stripe Identity                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Как это устроено:
--   1. Человек нажимает «Пройти проверку». Сервер (app/actions/verification.ts)
--      создаёт сессию у Stripe с metadata.user_id и пишет сюда заявку.
--   2. Документ и селфи человек показывает Stripe на его странице. К нам
--      файлы не попадают вообще (0019 закрыла бакет под них).
--   3. Stripe присылает подписанный вебхук (app/api/webhooks/stripe). Только
--      он, с серверным ключом, вызывает apply_verification_result().
--
-- Отметка ничего не даёт, кроме значка у ника — так обещает экран.
-- Снять её может только сервер; сам человек is_verified не меняет (0008:
-- у authenticated нет права UPDATE на эту колонку).

alter type public.notification_type add value if not exists 'verification_passed';
alter type public.notification_type add value if not exists 'verification_failed';

create table if not exists public.verification_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  provider            text not null default 'stripe_identity',
  provider_session_id text not null unique,
  status              text not null default 'pending',
  -- Код причины от провайдера (document_expired, selfie_face_mismatch...),
  -- без персональных данных. Человеку показывается понятным текстом.
  last_error_code     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint verification_requests_provider check (provider in ('stripe_identity')),
  constraint verification_requests_status check (
    status in ('pending', 'processing', 'verified', 'requires_input', 'canceled')
  ),
  constraint verification_requests_error_len check (char_length(last_error_code) <= 64)
);

comment on table public.verification_requests is
  'Заявки на проверку личности. Пишет сервер; итог — только вебхук провайдера.';

create index if not exists verification_requests_user_idx
  on public.verification_requests (user_id, created_at desc);

alter table public.verification_requests enable row level security;

revoke all on table public.verification_requests from anon, authenticated;
grant select on table public.verification_requests to authenticated;
grant insert (user_id, provider, provider_session_id) on table public.verification_requests to authenticated;

drop policy if exists verification_requests_select_own on public.verification_requests;
create policy verification_requests_select_own on public.verification_requests
  for select to authenticated
  using (user_id = public.current_user_id());

-- Новая заявка — только своя. Статус и причину ставит только вебхук.
drop policy if exists verification_requests_insert_own on public.verification_requests;
create policy verification_requests_insert_own on public.verification_requests
  for insert to authenticated
  with check (user_id = public.current_user_id());

/**
 * Итог проверки от провайдера. Вызывает только вебхук с серверным ключом:
 * у anon и authenticated права на функцию нет.
 *
 * Идемпотентна: Stripe повторяет вебхук при сбоях, а итог «verified» не
 * откатывается более поздним «processing», пришедшим не по порядку.
 */
create or replace function public.apply_verification_result(
  session_id text,
  member     uuid,
  new_status text,
  error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text;
begin
  if new_status not in ('processing', 'verified', 'requires_input', 'canceled') then
    raise exception 'unknown verification status: %', new_status;
  end if;

  select status into previous
  from public.verification_requests
  where provider_session_id = session_id and user_id = member
  for update;

  if not found then
    -- Заявка не записалась (сбой между Stripe и базой) — восстанавливаем.
    insert into public.verification_requests (user_id, provider_session_id, status)
    values (member, session_id, 'pending');
    previous := 'pending';
  end if;

  if previous = 'verified' or previous = new_status then
    return;
  end if;

  update public.verification_requests
  set status = new_status,
      last_error_code = case when new_status = 'requires_input' then left(error_code, 64) end,
      updated_at = now()
  where provider_session_id = session_id and user_id = member;

  if new_status = 'verified' then
    update public.users set is_verified = true where id = member;
    insert into public.notifications (user_id, type) values (member, 'verification_passed');
  elsif new_status = 'requires_input' then
    insert into public.notifications (user_id, type) values (member, 'verification_failed');
  end if;
end;
$$;

revoke all on function public.apply_verification_result(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_verification_result(text, uuid, text, text) to service_role;
