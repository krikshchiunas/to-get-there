-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0032 — ответы на сообщения и «Прочитано»                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Ответ. Сообщение может ссылаться на другое из той же переписки — в чате
-- идеи на сообщение той же идеи, в личке на сообщение того же разговора.
-- Удалили исходное — ответ остаётся, ссылка обнуляется.
--
-- «Прочитано». Отметка direct_message_reads (0010) теперь видна и
-- собеседнику — как в WhatsApp, взаимно: кто выключил отметки у себя
-- (privacy_settings.read_receipts = false), тот не показывает свои и не
-- видит чужие.
--
-- Сигналы. Удаление личного сообщения и новая отметка о прочтении будят
-- экран собеседника так же, как новое сообщение (0018).

/* ── ответы ────────────────────────────────────────────────────────── */

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

alter table public.direct_messages
  add column if not exists reply_to_id uuid references public.direct_messages (id) on delete set null;

create index if not exists messages_reply_to_idx on public.messages (reply_to_id) where reply_to_id is not null;
create index if not exists direct_messages_reply_to_idx on public.direct_messages (reply_to_id) where reply_to_id is not null;

create or replace function private.check_reply_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reply_to_id is null then
    return new;
  end if;

  if tg_table_name = 'messages' then
    if not exists (
      select 1 from public.messages m
      where m.id = new.reply_to_id and m.post_id = new.post_id
    ) then
      raise exception 'reply target is not in this chat' using errcode = '23503';
    end if;
  else
    if not exists (
      select 1 from public.direct_messages d
      where d.id = new.reply_to_id
        -- Генерируемый conversation_key в BEFORE ещё не посчитан — то же
        -- выражение, что в 0005.
        and d.conversation_key = least(new.sender_id::text, new.receiver_id::text)
          || ':' || greatest(new.sender_id::text, new.receiver_id::text)
    ) then
      raise exception 'reply target is not in this conversation' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.check_reply_target() from public, anon, authenticated;

drop trigger if exists messages_check_reply on public.messages;
create trigger messages_check_reply
  before insert on public.messages
  for each row execute function private.check_reply_target();

drop trigger if exists direct_messages_check_reply on public.direct_messages;
create trigger direct_messages_check_reply
  before insert on public.direct_messages
  for each row execute function private.check_reply_target();

/* ── настройка read_receipts ───────────────────────────────────────── */

alter table public.users alter column privacy_settings set default
  '{"who_can_message":"everyone","who_can_see_profile":"everyone","who_can_see_interests":"everyone","visible_in_search":true,"read_receipts":true}'::jsonb;

alter table public.users drop constraint if exists users_privacy_shape;

update public.users
set privacy_settings = privacy_settings || '{"read_receipts": true}'::jsonb
where not privacy_settings ? 'read_receipts';

alter table public.users add constraint users_privacy_shape check (
  jsonb_typeof(privacy_settings) = 'object'
  and privacy_settings - array[
    'who_can_message', 'who_can_see_profile', 'who_can_see_interests', 'visible_in_search', 'read_receipts'
  ] = '{}'::jsonb
  and coalesce(privacy_settings ->> 'who_can_message', '') in ('everyone', 'friends', 'nobody')
  and coalesce(privacy_settings ->> 'who_can_see_profile', '') in ('everyone', 'university', 'friends')
  and coalesce(privacy_settings ->> 'who_can_see_interests', '') in ('everyone', 'university', 'friends')
  and coalesce(jsonb_typeof(privacy_settings -> 'visible_in_search'), '') = 'boolean'
  and coalesce(jsonb_typeof(privacy_settings -> 'read_receipts'), '') = 'boolean'
);

create or replace function private.read_receipts_on(member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (u.privacy_settings ->> 'read_receipts')::boolean
    from public.users u where u.id = member
  ), false);
$$;

revoke all on function private.read_receipts_on(uuid) from public, anon;
grant execute on function private.read_receipts_on(uuid) to authenticated;

drop policy if exists direct_message_reads_select_own on public.direct_message_reads;
create policy direct_message_reads_select_own on public.direct_message_reads
  for select to authenticated
  using (
    user_id = private.current_user_id()
    or (
      partner_id = private.current_user_id()
      and private.read_receipts_on(user_id)
      and private.read_receipts_on(partner_id)
    )
  );

/* ── сигналы лички ─────────────────────────────────────────────────── */

create or replace function private.signal_direct_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'direct_message_reads' then
    -- Прочитал — узнаёт тот, чьи сообщения прочитаны.
    perform private.signal('user:' || new.partner_id::text);
  elsif tg_op = 'DELETE' then
    perform private.signal('user:' || old.receiver_id::text);
    perform private.signal('user:' || old.sender_id::text);
  end if;
  return null;
end;
$$;

revoke all on function private.signal_direct_change() from public, anon, authenticated;

drop trigger if exists direct_messages_signal_delete on public.direct_messages;
create trigger direct_messages_signal_delete
  after delete on public.direct_messages
  for each row execute function private.signal_direct_change();

drop trigger if exists direct_message_reads_signal on public.direct_message_reads;
create trigger direct_message_reads_signal
  after insert or update on public.direct_message_reads
  for each row execute function private.signal_direct_change();
