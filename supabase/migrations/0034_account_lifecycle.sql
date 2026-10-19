-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0034 — свои данные: выгрузить и удалить; сроки хранения              ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- DSGVO (GDPR), ст. 15, 17 и 20: человек вправе получить копию своих данных
-- в машиночитаемом виде и удалить аккаунт. Оба действия — из настроек, без
-- письма в поддержку.
--
--   export_my_data()   всё, что человек написал и настроил, одним JSON.
--                      security invoker: читает через RLS и видит ровно то,
--                      что человек и так видит в приложении.
--   delete_my_account() удаляет строку auth.users; каскады из 0003–0030
--                      уносят профиль, идеи, сообщения, подписки, голоса,
--                      уведомления и заявки. Файлы в Storage удаляет
--                      приложение до вызова (SQL их удалить не может).
--
-- Сроки хранения — то, что не нужно хранить вечно:
--   прочитанные уведомления   90 дней
--   журнал напоминаний        30 дней
--   разобранные жалобы        180 дней (нужны, чтобы видеть повторных
--                             нарушителей; открытые не удаляются)

/* ── выгрузка ──────────────────────────────────────────────────────── */

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  me uuid := private.current_user_id();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'format', 'to-get-there/export@1',
    'account', jsonb_build_object('email', auth.jwt() ->> 'email'),
    'profile', (select to_jsonb(u) - 'auth_user_id' from public.users u where u.id = me),
    'ideas', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at)
      from public.posts p where p.author_id = me), '[]'::jsonb),
    'joined_ideas', coalesce((
      select jsonb_agg(jsonb_build_object('post_id', pp.post_id, 'title', p.title, 'joined_at', pp.joined_at)
                       order by pp.joined_at)
      from public.post_participants pp
      left join public.posts p on p.id = pp.post_id
      where pp.user_id = me), '[]'::jsonb),
    'chat_messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
      from public.messages m where m.author_id = me), '[]'::jsonb),
    'polls', coalesce((
      select jsonb_agg(to_jsonb(pl) order by pl.created_at)
      from public.polls pl where pl.created_by = me), '[]'::jsonb),
    'poll_votes', coalesce((
      select jsonb_agg(to_jsonb(v)) from public.poll_votes v where v.user_id = me), '[]'::jsonb),
    'direct_messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id,
               'direction', case when d.sender_id = me then 'sent' else 'received' end,
               'partner', (select u.nickname from public.users u
                           where u.id = case when d.sender_id = me then d.receiver_id else d.sender_id end),
               'content', d.content,
               'media_url', d.media_url,
               'created_at', d.created_at)
             order by d.created_at)
      from public.direct_messages d
      where d.sender_id = me or d.receiver_id = me), '[]'::jsonb),
    'following', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', u.nickname, 'since', f.created_at))
      from public.follows f join public.users u on u.id = f.following_id
      where f.follower_id = me), '[]'::jsonb),
    'followers', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', u.nickname, 'since', f.created_at))
      from public.follows f join public.users u on u.id = f.follower_id
      where f.following_id = me), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', b.blocked_id, 'since', b.created_at))
      from public.user_blocks b where b.blocker_id = me), '[]'::jsonb),
    'reports_filed', coalesce((
      select jsonb_agg(jsonb_build_object(
               'target_type', r.target_type, 'target_id', r.target_id,
               'reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at))
      from public.reports r where r.reporter_id = me), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at)
      from public.notifications n where n.user_id = me), '[]'::jsonb),
    'identity_verification', coalesce((
      select jsonb_agg(to_jsonb(vr) order by vr.created_at)
      from public.verification_requests vr where vr.user_id = me), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

comment on function public.export_my_data() is
  'DSGVO ст. 15/20: копия данных зрителя одним JSON. Через RLS — только то, что зритель и так видит.';

/* ── удаление ──────────────────────────────────────────────────────── */

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_user_id();
  account uuid := auth.uid();
begin
  if me is null or account is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Ник и аватар в чужих уведомлениях — копии, каскад до них не дойдёт.
  delete from public.notifications n where n.payload ->> 'actor_id' = me::text;

  -- Каскад: public.users (0003) и всё, что на него ссылается.
  delete from auth.users u where u.id = account;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'DSGVO ст. 17: удаляет аккаунт вызывающего и всё, что с ним связано. Файлы Storage приложение удаляет до вызова.';

/* ── сроки хранения ────────────────────────────────────────────────── */

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
end;
$$;

revoke all on function private.purge_expired() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'tgt-purge-expired';
select cron.schedule('tgt-purge-expired', '17 3 * * *', $$select private.purge_expired()$$);
