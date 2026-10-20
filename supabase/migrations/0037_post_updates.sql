-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0037 — правка идеи: места и уведомление участникам                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Автор может править идею (права — posts_update_author из 0008, колонки —
-- grant update там же). Две вещи, которые нельзя оставить приложению:
--
--   1. Мест не может стать меньше, чем уже вступило. Иначе в идее «6 из 4».
--   2. Если поменялись время или место, участники должны об этом узнать —
--      как в Meetup: тот, кто уже собрался, иначе придёт не туда и не тогда.
--      Уведомление обязательное, его не выключить: это не новость, а
--      изменение того, на что человек уже согласился.

alter type public.notification_type add value if not exists 'post_updated';

/* ── места ─────────────────────────────────────────────────────────── */

create or replace function private.guard_post_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  joined integer;
begin
  if new.max_participants is not null then
    joined := private.participant_count(new.id);
    if new.max_participants < joined then
      raise exception 'max_participants % is below % joined', new.max_participants, joined
        using errcode = '23514', hint = 'capacity_below_joined';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_post_capacity() from public, anon, authenticated;

drop trigger if exists posts_guard_capacity on public.posts;
create trigger posts_guard_capacity
  before update of max_participants on public.posts
  for each row execute function private.guard_post_capacity();

/* ── уведомление об изменении ──────────────────────────────────────── */

create or replace function private.notify_post_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  time_changed  boolean := new.date_start is distinct from old.date_start;
  place_changed boolean := (new.geo_city, new.geo_address, new.geo_lat, new.geo_lng, new.geo_mode, new.geo_radius_m)
                           is distinct from
                           (old.geo_city, old.geo_address, old.geo_lat, old.geo_lng, old.geo_mode, old.geo_radius_m);
  actor_nick text;
  actor_av   text;
begin
  if not time_changed and not place_changed then
    return null;
  end if;

  select u.nickname, u.avatar_url into actor_nick, actor_av
  from public.users u where u.id = new.author_id;

  insert into public.notifications (user_id, type, payload)
  select pp.user_id, 'post_updated',
         jsonb_build_object(
           'actor_id', new.author_id::text,
           'actor_nickname', actor_nick,
           'actor_avatar_url', actor_av,
           'post_id', new.id::text,
           'post_title', new.title,
           'changed', case
             when time_changed and place_changed then 'time_place'
             when time_changed then 'time'
             else 'place'
           end
         )
  from public.post_participants pp
  where pp.post_id = new.id
    and pp.user_id <> new.author_id;

  return null;
end;
$$;

revoke all on function private.notify_post_updated() from public, anon, authenticated;

drop trigger if exists posts_notify_updated on public.posts;
create trigger posts_notify_updated
  after update on public.posts
  for each row execute function private.notify_post_updated();
