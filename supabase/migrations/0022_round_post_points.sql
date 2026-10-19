-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0022 — точность точки идеи задаёт база                               ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Идею читает любой вошедший. В режиме радиуса точка — это где был автор,
-- когда её создавал, то есть часто его дом. app/actions/posts.ts огрубляет
-- её до ~1 км, но вставить строку можно и напрямую через API, мимо
-- серверного кода. Поэтому то же правило — триггером:
--   radius → 2 знака (~1 км), area → 4 знака (~10 м, место показал сам
--   автор), city → точки нет.

create or replace function public.posts_round_point()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.geo_mode = 'city' then
    new.geo_lat := null;
    new.geo_lng := null;
  elsif new.geo_lat is not null and new.geo_lng is not null then
    if new.geo_mode = 'radius' then
      new.geo_lat := round(new.geo_lat::numeric, 2)::double precision;
      new.geo_lng := round(new.geo_lng::numeric, 2)::double precision;
    else
      new.geo_lat := round(new.geo_lat::numeric, 4)::double precision;
      new.geo_lng := round(new.geo_lng::numeric, 4)::double precision;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.posts_round_point() from public, anon, authenticated;

drop trigger if exists posts_round_point on public.posts;
create trigger posts_round_point
  before insert or update of geo_lat, geo_lng, geo_mode on public.posts
  for each row execute function public.posts_round_point();

-- Уже сохранённые точки — по тем же правилам.
update public.posts set geo_lat = geo_lat where geo_lat is not null or geo_mode = 'city';
