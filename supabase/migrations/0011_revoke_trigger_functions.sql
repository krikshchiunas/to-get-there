-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0011 — триггерные функции убраны из публичного API                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- PostgREST публикует каждую функцию схемы public как /rest/v1/rpc/<имя>.
-- В 0007 триггерные функции были отозваны у роли public, но Supabase
-- выдаёт anon и authenticated привилегии отдельно, поэтому эндпоинты
-- оставались открытыми (проверено советником Supabase: 30 предупреждений).
-- Вызов такой функции вне триггера всё равно упал бы — нет NEW/OLD, — но
-- эндпоинта быть не должно вовсе.

revoke execute on function public.posts_set_university()            from anon, authenticated;
revoke execute on function public.posts_add_author_participant()    from anon, authenticated;
revoke execute on function public.users_guard_verification()        from anon, authenticated;
revoke execute on function public.messages_single_pin()             from anon, authenticated;
revoke execute on function public.poll_votes_check_option()         from anon, authenticated;
revoke execute on function public.notify_new_participant()          from anon, authenticated;
revoke execute on function public.notify_new_message()              from anon, authenticated;
revoke execute on function public.notify_new_follower()             from anon, authenticated;
revoke execute on function public.notify_new_post_from_following()  from anon, authenticated;

revoke execute on function public.mark_conversation_read(uuid)      from anon;

-- Остальные helpers (are_friends, can_*, post_role, …) остаются доступными
-- намеренно: их вызывают политики RLS, а политика исполняется с правами
-- запрашивающей роли. Они читают только то, что политика и так разрешает.
