-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0033 — «печатает…» и «сейчас в чате»                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Сигналы из базы (0018) идут в каналы post:<id> и user:<id>, и писать в
-- них клиент не может. Для того, что шлют сами клиенты, — отдельные каналы:
--
--   chat:<post_id>   чат идеи. Слушать — кто может войти в чат (как и
--                    читать его сообщения), писать и отмечаться — участник.
--   dm:<a>:<b>       личка, a и b — id собеседников по возрастанию, как в
--                    conversation_key. Только эти двое и только пока между
--                    ними нет блокировки.
--
-- Разделение каналов значит, что клиент не может подделать сигнал
-- «изменилось» и заставить чужие экраны перечитываться.
--
-- В событиях — только id и ник того, кто печатает. Подделать «печатает»
-- от чужого имени участник чата может (Realtime не подписывает отправителя),
-- поэтому клиент показывает только тех, кто есть в составе чата; на права
-- и данные это не влияет.

create or replace function private.dm_topic_member(topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    split_part(topic, ':', 1) = 'dm'
    and private.try_uuid(split_part(topic, ':', 2)) is not null
    and private.try_uuid(split_part(topic, ':', 3)) is not null
    and split_part(topic, ':', 2) < split_part(topic, ':', 3)
    and private.current_user_id() is not null
    and private.current_user_id()::text in (split_part(topic, ':', 2), split_part(topic, ':', 3))
    and not private.is_blocked_between(
      private.try_uuid(split_part(topic, ':', 2)),
      private.try_uuid(split_part(topic, ':', 3))
    );
$$;

revoke all on function private.dm_topic_member(text) from public, anon;
grant execute on function private.dm_topic_member(text) to authenticated;

drop policy if exists tgt_client_events_listen on realtime.messages;
create policy tgt_client_events_listen on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (
      (
        split_part(realtime.topic(), ':', 1) = 'chat'
        and private.can_enter_post_chat(
          private.try_uuid(split_part(realtime.topic(), ':', 2)),
          private.current_user_id()
        )
      )
      or private.dm_topic_member(realtime.topic())
    )
  );

drop policy if exists tgt_client_events_send on realtime.messages;
create policy tgt_client_events_send on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (
      (
        split_part(realtime.topic(), ':', 1) = 'chat'
        and private.is_post_member(
          private.try_uuid(split_part(realtime.topic(), ':', 2)),
          private.current_user_id()
        )
      )
      or private.dm_topic_member(realtime.topic())
    )
  );
