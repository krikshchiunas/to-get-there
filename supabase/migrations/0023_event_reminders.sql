-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0023 — напоминания за час и за 30 минут до начала                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Переключатели event_reminder_1h и event_reminder_30m в настройках
-- уведомлений до сих пор ничего не включали: писать напоминания было
-- некому. Теперь их пишет send_event_reminders(), а pg_cron вызывает её
-- каждую минуту.
--
-- Окна, а не точные моменты: «за час» — когда до начала от 60 до 30 минут,
-- «за 30 минут» — от 30 до 0. Так пропущенный запуск cron (рестарт, сбой)
-- не съедает напоминание, а журнал event_reminder_log гарантирует, что
-- каждое уходит один раз. Кто вступил за 20 минут до начала, получит
-- только второе — первое уже не про него. В тексте — честное число минут.
--
-- Закрытый набор не отменяет напоминание: закрывают набор новых людей, а
-- те, кто уже в чате, по-прежнему идут.

create extension if not exists pg_cron;

create table if not exists public.event_reminder_log (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  kind    text not null,
  sent_at timestamptz not null default now(),
  primary key (post_id, user_id, kind),
  constraint event_reminder_log_kind check (kind in ('1h', '30m'))
);

comment on table public.event_reminder_log is
  'Какие напоминания уже ушли — чтобы каждое ушло один раз. Пишет только send_event_reminders().';

alter table public.event_reminder_log enable row level security;
revoke all on table public.event_reminder_log from anon, authenticated;
-- Политик нет намеренно: клиентам журнал не нужен ни на чтение, ни на запись.

create or replace function public.send_event_reminders(at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  sent integer := 0;
  batch integer;
begin
  -- Одним запросом на окно: кандидаты → в журнал (дубликаты отсекает ключ)
  -- → только реально записанные превращаются в уведомления.
  with windows(kind, setting, lo, hi) as (
    values
      ('1h',  'event_reminder_1h',  interval '30 minutes', interval '60 minutes'),
      ('30m', 'event_reminder_30m', interval '0 minutes',  interval '30 minutes')
  ),
  due as (
    select w.kind, p.id as post_id, p.title, p.date_start, pp.user_id
    from windows w
    join public.posts p
      on p.date_start > at + w.lo
     and p.date_start <= at + w.hi
    join public.post_participants pp on pp.post_id = p.id
    where public.notification_enabled(pp.user_id, w.setting)
  ),
  logged as (
    insert into public.event_reminder_log (post_id, user_id, kind)
    select post_id, user_id, kind from due
    on conflict do nothing
    returning post_id, user_id, kind
  )
  insert into public.notifications (user_id, type, payload)
  select
    l.user_id,
    'event_reminder',
    jsonb_build_object(
      'post_id', d.post_id::text,
      'post_title', d.title,
      'minutes_until', greatest(1, ceil(extract(epoch from (d.date_start - at)) / 60))::int
    )
  from logged l
  join due d on d.post_id = l.post_id and d.user_id = l.user_id and d.kind = l.kind;

  get diagnostics batch = row_count;
  sent := sent + batch;

  -- Журнал старше суток не нужен: идея давно началась.
  delete from public.event_reminder_log where sent_at < at - interval '1 day';

  return sent;
end;
$$;

comment on function public.send_event_reminders(timestamptz) is
  'Напоминания о начале по notification_settings.event_reminder_1h / _30m. Раз в минуту из pg_cron.';

revoke all on function public.send_event_reminders(timestamptz) from public, anon, authenticated;

-- Повторное применение миграции не плодит задания.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'tgt-event-reminders') then
    perform cron.unschedule('tgt-event-reminders');
  end if;
  perform cron.schedule('tgt-event-reminders', '* * * * *', 'select public.send_event_reminders()');
end
$$;
