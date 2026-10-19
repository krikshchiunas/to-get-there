-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0028 — убрать переключатель открытого чтения                         ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- open_read был нужен на этапах 4–5, пока входа не было: каждая политика
-- SELECT начиналась с `private.open_read() or …`. С 0014 он выключен, но
-- сама возможность осталась — одна строка
--   update app_flags set open_read = true
-- открыла бы все данные любому вошедшему без проверки прав. Переключатель,
-- который нельзя включать, — не настройка, а риск. Политики переписаны без
-- него, функция и таблица удалены.

alter policy users_select_visible on public.users using (
  id = private.current_user_id()
  or private.can_see_profile(id, private.current_user_id())
  or private.shares_post_with(id, private.current_user_id())
);

alter policy posts_select_signed_in on public.posts
  using (private.current_user_id() is not null);

alter policy post_participants_select_signed_in on public.post_participants
  using (private.current_user_id() is not null);

alter policy post_moderators_select_signed_in on public.post_moderators
  using (private.current_user_id() is not null);

alter policy messages_select_chat on public.messages
  using (private.can_enter_post_chat(post_id, private.current_user_id()));

alter policy polls_select_chat on public.polls
  using (private.can_enter_post_chat(post_id, private.current_user_id()));

alter policy poll_votes_select_chat on public.poll_votes
  using (private.can_enter_post_chat(private.poll_post_id(poll_id), private.current_user_id()));

alter policy direct_messages_select_own on public.direct_messages using (
  sender_id = private.current_user_id()
  or receiver_id = private.current_user_id()
);

alter policy follows_select_signed_in on public.follows
  using (private.current_user_id() is not null);

alter policy notifications_select_own on public.notifications
  using (user_id = private.current_user_id());

drop function if exists private.open_read();
drop table if exists public.app_flags;
