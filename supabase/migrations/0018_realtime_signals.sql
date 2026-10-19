-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0018 — живые экраны: сигналы через приватные каналы Realtime         ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Почему не postgres_changes (0009 оставляет таблицы в публикации, но
-- приложение на них больше не подписывается):
--   - у всех таблиц ключ — id, а на DELETE Realtime присылает только ключ и
--     не применяет фильтры. Исключение участника или снятие модератора
--     нельзя было бы привязать к идее.
--   - каждая подписка на postgres_changes проверяет RLS на каждое событие.
--
-- Вместо этого триггеры шлют пустой сигнал «изменилось» в канал:
--   post:<uuid>  — сообщения, опросы, голоса, участники, модераторы, идея;
--   user:<uuid>  — личные сообщения (получателю) и уведомления.
-- Клиент по сигналу просит сервер перерисовать страницу (lib/live.ts):
-- данные по-прежнему идут только через сервер и RLS, в сигнале их нет.
--
-- Каналы приватные: слушать можно только с политикой на realtime.messages.
-- Канал идеи — любому вошедшему (саму идею видит любой вошедший, а сигнал
-- пустой). Личный канал — только его владельцу.

-- ── Отправка ──────────────────────────────────────────────────────────

create or replace function public.signal(topic text)
returns void
language sql
security definer
set search_path = ''
as $$
  select realtime.send('{}'::jsonb, 'changed', topic, true);
$$;

comment on function public.signal(text) is
  'Пустой сигнал «изменилось» в приватный канал Realtime. Только для триггеров.';

revoke all on function public.signal(text) from public, anon, authenticated;

create or replace function public.signal_post_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- jsonb, а не record: у posts нет post_id, у poll_votes — тоже, и
  -- обращение к несуществующему полю записи упало бы ещё при разборе.
  row_data jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  post uuid;
begin
  post := case tg_table_name
    when 'posts'      then (row_data ->> 'id')::uuid
    when 'poll_votes' then public.poll_post_id((row_data ->> 'poll_id')::uuid)
    else (row_data ->> 'post_id')::uuid
  end;

  if post is not null then
    perform public.signal('post:' || post::text);
  end if;
  return null;
end;
$$;

create or replace function public.signal_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'direct_messages' then
    perform public.signal('user:' || new.receiver_id::text);
  else
    perform public.signal('user:' || new.user_id::text);
  end if;
  return null;
end;
$$;

revoke all on function public.signal_post_change() from public, anon, authenticated;
revoke all on function public.signal_user_change() from public, anon, authenticated;

-- ── Триггеры ──────────────────────────────────────────────────────────

do $$
declare
  target text;
begin
  foreach target in array array[
    'messages', 'polls', 'poll_votes', 'post_participants', 'post_moderators'
  ] loop
    execute format('drop trigger if exists %I on public.%I', target || '_signal', target);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.signal_post_change()',
      target || '_signal', target
    );
  end loop;
end
$$;

-- Идея: закрытие набора, правки. Удаление идеи уносит чат целиком —
-- открытые экраны узнают об этом при следующем обновлении.
drop trigger if exists posts_signal on public.posts;
create trigger posts_signal
  after update on public.posts
  for each row execute function public.signal_post_change();

drop trigger if exists direct_messages_signal on public.direct_messages;
create trigger direct_messages_signal
  after insert on public.direct_messages
  for each row execute function public.signal_user_change();

drop trigger if exists notifications_signal on public.notifications;
create trigger notifications_signal
  after insert on public.notifications
  for each row execute function public.signal_user_change();

-- ── Кто может слушать ─────────────────────────────────────────────────

drop policy if exists tgt_listen_signals on realtime.messages;
create policy tgt_listen_signals on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.current_user_id() is not null
    and (
      realtime.topic() = 'user:' || public.current_user_id()::text
      or (
        split_part(realtime.topic(), ':', 1) = 'post'
        and public.try_uuid(split_part(realtime.topic(), ':', 2)) is not null
      )
    )
  );
