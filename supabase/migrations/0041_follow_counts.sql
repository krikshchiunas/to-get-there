-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0041 — счётчики подписок одним запросом                              ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Раньше приложение забирало все строки follows для авторов ленты и
-- считало их в JS (lib/data/social.ts → loadFollowCounts). У популярного
-- автора это тысячи строк на каждый показ ленты, а PostgREST отдаёт не
-- больше 1 000 — счётчик молча обрезался. Нагрузочный прогон
-- (supabase/perf) это показал.
--
-- Теперь база считает сама: два count(*) по индексам на человека.
-- security invoker — политика follows (читать может любой вошедший)
-- действует как прежде.

create or replace function public.get_follow_counts(user_ids uuid[])
returns table (user_id uuid, followers bigint, following bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select ids.id,
         (select count(*) from public.follows f where f.following_id = ids.id),
         (select count(*) from public.follows f where f.follower_id = ids.id)
  from (select distinct unnest(user_ids[1:200]) as id) ids
  where ids.id is not null;
$$;

comment on function public.get_follow_counts(uuid[]) is
  'Подписчики и подписки для набора людей (до 200 за вызов). Через RLS follows.';

revoke all on function public.get_follow_counts(uuid[]) from public, anon;
grant execute on function public.get_follow_counts(uuid[]) to authenticated, service_role;
