-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0025 — меньше кода с правами владельца                               ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- После 0024 советник Supabase отмечал ещё четыре места. Здесь три из них
-- переводятся на права вызывающего, четвёртое (current_user_id) остаётся
-- как есть намеренно: политика users сама вызывает current_user_id(), и
-- без прав владельца функция вызывала бы политику, а та — функцию.

/* ── post_cards: лента на правах читающего ───────────────────────────── */

-- Раньше представление читало users с правами владельца, чтобы идеи
-- авторов со скрытым профилем не выпадали из ленты (0007). Теперь RLS
-- таблиц применяется как обычно, а из users берётся только публичный блок
-- автора — через одну функцию, которой в API не видно (схема private).
create or replace function private.author_card(author uuid)
returns table (nickname text, avatar_url text, is_verified boolean, faculty text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.nickname, u.avatar_url, u.is_verified, u.faculty
  from public.users u
  where u.id = author;
$$;

comment on function private.author_card(uuid) is
  'Публичный блок автора для post_cards: ник, аватар, отметка, факультет. Больше ничего из users сюда не добавлять.';

revoke all on function private.author_card(uuid) from public;
grant execute on function private.author_card(uuid) to authenticated, service_role;

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
join public.universities un on un.id = p.university_id
join public.categories c on c.id = p.category_id
left join (
  select pp.post_id, count(*) as participant_count
  from public.post_participants pp
  group by pp.post_id
) pc on pc.post_id = p.id;

revoke all on public.post_cards from anon, authenticated;
grant select on public.post_cards to authenticated;

/* ── счётчик и «прочитано» в личке: RLS справляется сам ──────────────── */

-- Свои входящие человек видит по direct_messages_select_own, свои отметки
-- прочтения — по direct_message_reads_*_own. Права владельца не нужны.
alter function public.unread_direct_total() security invoker;
alter function public.mark_conversation_read(uuid) security invoker;
alter function public.mark_conversation_read(uuid) set search_path = '';

/* ── служебные таблицы: клиентам — никак, и это написано явно ────────── */

drop policy if exists email_allowlist_no_client_access on public.email_allowlist;
create policy email_allowlist_no_client_access on public.email_allowlist
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists event_reminder_log_no_client_access on public.event_reminder_log;
create policy event_reminder_log_no_client_access on public.event_reminder_log
  for all to anon, authenticated
  using (false)
  with check (false);
