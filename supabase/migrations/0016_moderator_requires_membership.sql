-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0016 — модератор существует только пока он в чате                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Найдено на живой базе: автор исключил модератора, строка в
-- post_participants удалилась, а в post_moderators осталась. can_moderate()
-- смотрела только на post_moderators, поэтому исключённый человек с can_kick
-- мог и дальше удалять участников, а с can_pin — закреплять сообщения.
--
-- Два слоя:
--   1. Триггер: ушёл или исключён из чата — роль модератора снимается.
--   2. can_moderate() и post_role() требуют членства. Даже если строка
--      модератора как-то переживёт выход, прав она не даст.

create or replace function public.drop_moderator_on_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.post_moderators m
  where m.post_id = old.post_id and m.user_id = old.user_id;
  return old;
end;
$$;

comment on function public.drop_moderator_on_leave() is
  'Снимает роль модератора, когда человек выходит из чата идеи или его исключают.';

revoke all on function public.drop_moderator_on_leave() from public, anon, authenticated;

drop trigger if exists post_participants_drop_moderator on public.post_participants;
create trigger post_participants_drop_moderator
  after delete on public.post_participants
  for each row execute function public.drop_moderator_on_leave();

create or replace function public.can_moderate(post uuid, actor uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when actor is null then false
    when permission_key not in ('can_post_media', 'can_pin', 'can_poll', 'can_kick') then false
    when public.post_author_id(post) = actor then true
    when not public.is_post_member(post, actor) then false
    else coalesce((
      select (m.permissions ->> permission_key)::boolean
      from public.post_moderators m
      where m.post_id = post and m.user_id = actor
    ), false)
  end;
$$;

create or replace function public.post_role(post uuid, member uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when member is null then 'guest'
    when public.post_author_id(post) = member then 'author'
    when not public.is_post_member(post, member) then 'guest'
    when exists (
      select 1 from public.post_moderators m where m.post_id = post and m.user_id = member
    ) then 'moderator'
    else 'participant'
  end;
$$;

-- Уже осиротевшие строки (как та, на которой это нашлось).
delete from public.post_moderators m
where not exists (
  select 1 from public.post_participants p
  where p.post_id = m.post_id and p.user_id = m.user_id
);
