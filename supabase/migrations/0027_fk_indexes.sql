-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0027 — индексы под внешние ключи                                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Советник по производительности: без индекса удаление пользователя или
-- университета просматривает эти таблицы целиком, чтобы найти ссылки.

create index if not exists direct_message_reads_partner_idx
  on public.direct_message_reads (partner_id);

create index if not exists email_allowlist_university_idx
  on public.email_allowlist (university_id);

create index if not exists event_reminder_log_user_idx
  on public.event_reminder_log (user_id);
