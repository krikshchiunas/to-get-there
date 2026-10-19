-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0024 — внутренние функции уходят из публичного API                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Всё, что лежит в схеме public, PostgREST отдаёт как /rest/v1/rpc/<имя>.
-- Политики RLS вызывают помощников вроде can_see_profile(target, viewer) —
-- и через API их мог вызвать любой вошедший с любыми аргументами:
-- notification_enabled(чужой id, ...) выдавала чужие настройки
-- уведомлений, can_message_user(...) — чужие правила личных сообщений.
-- Советник Supabase (0029_authenticated_security_definer_function_executable)
-- отмечал 22 такие функции.
--
-- Решение — схема private, которую PostgREST не публикует. Политики и
-- представления ссылаются на функции по OID и после переноса работают как
-- раньше. Тела функций хранятся текстом, поэтому все упоминания
-- public.<перенесённая>( переписываются на private.<...>(.
--
-- В public остаётся только то, что приложение вызывает намеренно:
-- current_user_id, cast_vote, mark_conversation_read, unread_direct_total
-- (и функции, на которые права у клиентов нет вовсе).

create schema if not exists private;
comment on schema private is
  'Помощники RLS и триггеров. Не публикуется через PostgREST (только public).';

-- USAGE нужен ролям, от имени которых считаются политики и
-- представления с security_invoker. Через API схема всё равно не видна.
grant usage on schema private to anon, authenticated, service_role;

do $$
declare
  moved text[] := array[
    'are_friends', 'audience_allows', 'can_enter_post_chat', 'can_join_post',
    'can_message_user', 'can_moderate', 'can_see_interests', 'can_see_profile',
    'follows_user', 'is_post_author', 'is_post_member', 'notification_enabled',
    'open_read', 'participant_count', 'poll_post_id', 'post_author_id',
    'post_role', 'shares_post_with', 'signal', 'try_uuid', 'unread_direct_count'
  ];
  fn record;
  name text;
  body text;
  rewritten text;
begin
  -- 1. Перенос. Права на вызов переезжают вместе с функцией.
  for fn in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (moved)
  loop
    execute format('alter function %s set schema private', fn.oid::regprocedure);
  end loop;

  -- 2. Тела, где имена записаны текстом: public.x( → private.x(.
  for fn in
    select p.oid
    from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and p.prokind = 'f'
  loop
    body := pg_get_functiondef(fn.oid);
    rewritten := body;
    foreach name in array moved loop
      rewritten := replace(rewritten, 'public.' || name || '(', 'private.' || name || '(');
    end loop;
    if rewritten <> body then
      execute rewritten;
    end if;
  end loop;
end
$$;

-- Помощникам, которые не нужны ни политикам, ни представлениям, право на
-- вызов клиентам больше не нужно вовсе: их зовут только другие функции
-- с правами владельца.
revoke execute on function private.notification_enabled(uuid, text) from anon, authenticated;
revoke execute on function private.post_role(uuid, uuid) from anon, authenticated;
revoke execute on function private.participant_count(uuid) from anon, authenticated;
revoke execute on function private.signal(text) from anon, authenticated;
