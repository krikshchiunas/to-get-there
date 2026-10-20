-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0038 — ключ changed в уведомлениях                                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Уведомление post_updated (0037) говорит, что именно поменялось: время,
-- место или и то и другое. Форма payload строгая (0006), поэтому новый ключ
-- добавляется в проверку явно — со списком допустимых значений.

alter table public.notifications drop constraint if exists notifications_payload_shape;
alter table public.notifications add constraint notifications_payload_shape check (
  jsonb_typeof(payload) = 'object'
  and payload - array[
    'actor_id', 'actor_nickname', 'actor_avatar_url', 'post_id', 'post_title',
    'message_preview', 'minutes_until', 'changed'
  ] = '{}'::jsonb
  and (not payload ? 'actor_id'       or coalesce(jsonb_typeof(payload -> 'actor_id'), '') = 'string')
  and (not payload ? 'actor_nickname' or coalesce(jsonb_typeof(payload -> 'actor_nickname'), '') = 'string')
  and (not payload ? 'post_id'        or coalesce(jsonb_typeof(payload -> 'post_id'), '') = 'string')
  and (not payload ? 'post_title'     or coalesce(jsonb_typeof(payload -> 'post_title'), '') = 'string')
  and (not payload ? 'minutes_until'  or coalesce(jsonb_typeof(payload -> 'minutes_until'), '') = 'number')
  and (not payload ? 'changed'        or coalesce(payload ->> 'changed', '') in ('time', 'place', 'time_place'))
);
