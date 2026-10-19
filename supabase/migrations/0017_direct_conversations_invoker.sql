-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0017 — список личных чатов читается с правами читающего              ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- 0012 пересоздала direct_conversations, и представление получило права по
-- умолчанию Supabase: anon и authenticated — INSERT/UPDATE/DELETE/TRUNCATE.
-- Писать в него нельзя (DISTINCT ON не обновляется), но права лишние.
--
-- Заодно security_invoker = true. Представлению не нужно обходить RLS:
-- свои direct_messages человек видит и так, а unread_direct_count() и
-- can_message_user() — security definer сами по себе. Советник Supabase
-- (0010_security_definer_view) больше не ругается на это представление.
--
-- post_cards остаётся security definer намеренно — причина описана в 0007.

alter view public.direct_conversations set (security_invoker = true);

revoke all on public.direct_conversations from anon, authenticated;
grant select on public.direct_conversations to authenticated;
