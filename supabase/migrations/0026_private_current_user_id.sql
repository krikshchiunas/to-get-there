-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0026 — current_user_id() тоже уходит из API                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Последний помощник с правами владельца, который был виден как
-- /rest/v1/rpc/current_user_id. Вреда от него не было (он отдаёт только
-- свой же id), но и нужды нет: приложение находит свою строку users
-- обычным запросом по auth_user_id (lib/data/session.ts), а политики
-- ссылаются на функцию по OID и переноса не замечают.
--
-- Права владельца остаются: политика users сама зовёт current_user_id(),
-- и без них функция и политика вызывали бы друг друга по кругу.

do $$
declare
  fn record;
  body text;
  rewritten text;
begin
  alter function public.current_user_id() set schema private;

  for fn in
    select p.oid
    from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and p.prokind = 'f'
  loop
    body := pg_get_functiondef(fn.oid);
    rewritten := replace(body, 'public.current_user_id(', 'private.current_user_id(');
    if rewritten <> body then
      execute rewritten;
    end if;
  end loop;
end
$$;
