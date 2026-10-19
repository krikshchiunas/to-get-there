-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Что выполнить перед запуском — НЕ СЕЙЧАС                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Сейчас в приложении нет авторизации, поэтому база сознательно открыта на
-- чтение: app_flags.open_read = true, и политики SELECT пропускают любого с
-- публикуемым ключом. Это нужно, чтобы экраны можно было смотреть до
-- появления регистрации. На боевом запуске это недопустимо.
--
-- Порядок финального этапа:
--   1. supabase/later/auth_bridge.sql — регистрация и проверка
--      университетской почты.
--   2. Этот файл.
--   3. Перепроверить советник: Supabase → Advisors → Security.

/* ── 1. Закрыть режим открытого чтения ──────────────────────────────── */

-- После этого каждая политика SELECT требует вошедшего пользователя:
-- current_user_id() возвращает NULL без сессии, и политики отказывают.
update public.app_flags set open_read = false, updated_at = now() where id;

/* ── 2. Убрать у анонима доступ к функциям-помощникам ───────────────── */

-- Их вызывают политики RLS, а политика исполняется с правами запрашивающей
-- роли — поэтому пока open_read = true они обязаны быть доступны anon.
-- Когда чтение требует входа, аноним не должен мочь ничего: иначе через
-- /rest/v1/rpc/are_friends можно узнать, дружат ли два произвольных
-- человека, а через post_role — роль человека в чужом чате.

revoke execute on function public.are_friends(uuid, uuid)                from anon;
revoke execute on function public.audience_allows(text, uuid, uuid)      from anon;
revoke execute on function public.can_enter_post_chat(uuid, uuid)        from anon;
revoke execute on function public.can_join_post(uuid, uuid)              from anon;
revoke execute on function public.can_message_user(uuid, uuid)           from anon;
revoke execute on function public.can_moderate(uuid, uuid, text)         from anon;
revoke execute on function public.can_see_interests(uuid, uuid)          from anon;
revoke execute on function public.can_see_profile(uuid, uuid)            from anon;
revoke execute on function public.current_user_id()                      from anon;
revoke execute on function public.follows_user(uuid, uuid)               from anon;
revoke execute on function public.is_post_author(uuid, uuid)             from anon;
revoke execute on function public.is_post_member(uuid, uuid)             from anon;
revoke execute on function public.notification_enabled(uuid, text)       from anon;
revoke execute on function public.open_read()                            from anon;
revoke execute on function public.participant_count(uuid)                from anon;
revoke execute on function public.poll_post_id(uuid)                     from anon;
revoke execute on function public.post_author_id(uuid)                   from anon;
revoke execute on function public.post_role(uuid, uuid)                  from anon;
revoke execute on function public.shares_post_with(uuid, uuid)           from anon;

/* ── 3. Убрать у анонима чтение таблиц ──────────────────────────────── */

-- Справочники (universities, categories) остаются открытыми: они нужны
-- экрану регистрации, чтобы показать список вузов.

revoke select on table public.users             from anon;
revoke select on table public.posts             from anon;
revoke select on table public.post_participants from anon;
revoke select on table public.post_moderators   from anon;
revoke select on table public.messages          from anon;
revoke select on table public.polls             from anon;
revoke select on table public.poll_votes        from anon;
revoke select on table public.direct_messages   from anon;
revoke select on table public.follows           from anon;
revoke select on table public.notifications     from anon;
revoke select on table public.active_posts      from anon;
revoke select on table public.post_cards        from anon;

/* ── 4. Проверка ────────────────────────────────────────────────────── */

select
  (select open_read from public.app_flags where id) as "открытое_чтение",
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')) as "функций_доступно_анониму";
-- Ожидается: открытое_чтение = false, функций_доступно_анониму = 0.
