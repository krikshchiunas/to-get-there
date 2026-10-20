-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0036 — поиск людей на сервере                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Раньше экран поиска получал всех, кто виден в поиске, и фильтровал их в
-- браузере. Это значило, что каждый открывший поиск скачивал профили всех
-- студентов — даже не собираясь никого искать (минимизация данных, DSGVO
-- ст. 5 п. 1 c), и что страница росла вместе с числом пользователей.
--
-- Теперь браузер присылает строку, а база отдаёт не больше max_results
-- совпадений. security invoker: функция видит ровно то, что видит
-- вызывающий по RLS (0008, 0029) — скрытые профили и заблокировавшие сюда
-- не попадут.

create or replace function public.search_people(q text, max_results integer default 30)
returns setof public.users
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    -- % и _ в запросе — буквы, а не шаблон.
    select '%' || replace(replace(replace(lower(btrim(q)), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
           lower(btrim(q)) as raw
  )
  select u.*
  from public.users u, needle n
  where char_length(n.raw) >= 2
    and (u.privacy_settings ->> 'visible_in_search') = 'true'
    and u.id is distinct from private.current_user_id()
    and (
      u.nickname ilike n.pattern
      or coalesce(u.faculty, '') ilike n.pattern
      or exists (select 1 from unnest(u.interests) i where i ilike n.pattern)
      or exists (
        select 1 from public.universities un
        where un.id = u.university_id and un.short_name ilike n.pattern
      )
    )
  order by (u.nickname ilike n.raw || '%') desc, u.nickname
  limit least(greatest(coalesce(max_results, 30), 1), 50);
$$;

revoke all on function public.search_people(text, integer) from public, anon;
grant execute on function public.search_people(text, integer) to authenticated;

comment on function public.search_people(text, integer) is
  'Поиск людей по нику, факультету, интересам и вузу. Права — вызывающего (RLS), не больше 50 строк.';
