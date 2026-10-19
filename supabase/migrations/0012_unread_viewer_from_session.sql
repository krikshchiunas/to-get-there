-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0012 — счётчик непрочитанных берёт читателя из сессии                ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Исправляет IDOR в первой редакции 0010: unread_direct_count(viewer,
-- partner) принимала читателя аргументом, была security definer и выдана
-- роли authenticated. Любой залогиненный мог подставить чужой id и узнать
-- число непрочитанных у другого человека.
--
-- 0010 в этом репозитории уже исправлена, поэтому при чистом проигрывании
-- миграций файл просто пересоздаёт те же объекты. Он нужен для баз, где
-- 0010 успела примениться в старой редакции.

drop view if exists public.direct_conversations;
drop function if exists public.unread_direct_count(uuid, uuid);
drop function if exists public.unread_direct_total(uuid);

create or replace function public.unread_direct_count(partner uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.direct_messages dm
  left join public.direct_message_reads r
    on r.user_id = public.current_user_id() and r.partner_id = partner
  where public.current_user_id() is not null
    and dm.sender_id = partner
    and dm.receiver_id = public.current_user_id()
    and (r.read_at is null or dm.created_at > r.read_at);
$$;

create or replace function public.unread_direct_total()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.direct_messages dm
  left join public.direct_message_reads r
    on r.user_id = public.current_user_id() and r.partner_id = dm.sender_id
  where public.current_user_id() is not null
    and dm.receiver_id = public.current_user_id()
    and (r.read_at is null or dm.created_at > r.read_at);
$$;

create or replace view public.direct_conversations with (security_invoker = false) as
with viewer as (
  select public.current_user_id() as id
),
mine as (
  select dm.*,
    case when dm.sender_id = v.id then dm.receiver_id else dm.sender_id end as partner_id
  from public.direct_messages dm
  cross join viewer v
  where v.id is not null and (dm.sender_id = v.id or dm.receiver_id = v.id)
),
latest as (
  select distinct on (partner_id) * from mine order by partner_id, created_at desc
)
select
  l.partner_id,
  l.id           as last_message_id,
  l.sender_id    as last_sender_id,
  l.content      as last_content,
  l.media_url    as last_media_url,
  l.created_at   as last_created_at,
  public.unread_direct_count(l.partner_id)                      as unread_count,
  public.can_message_user(l.partner_id, (select id from viewer)) as can_reply
from latest l
order by l.created_at desc;

revoke execute on function public.unread_direct_count(uuid)    from public, anon;
revoke execute on function public.unread_direct_total()        from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;

grant execute on function public.unread_direct_count(uuid)     to authenticated;
grant execute on function public.unread_direct_total()         to authenticated;
grant execute on function public.mark_conversation_read(uuid)  to authenticated;
grant select on public.direct_conversations to authenticated;
