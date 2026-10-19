-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0035 — замечания советника Supabase к 0031 и 0034                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- 1. private.rate_limited — фиксированный search_path, как у всех функций.
-- 2. delete_my_account — та же схема, что у остальных помощников (0024):
--    в публичном API только обёртка с правами вызывающего, а сама работа с
--    правами владельца — в схеме private, которую PostgREST не публикует.
--    Удаляет по-прежнему только аккаунт того, кто вызвал.

alter function private.rate_limited(text) set search_path = '';

create or replace function private.delete_account_of_caller()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_user_id();
  account uuid := auth.uid();
begin
  if me is null or account is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Ник и аватар в чужих уведомлениях — копии, каскад до них не дойдёт.
  delete from public.notifications n where n.payload ->> 'actor_id' = me::text;

  -- Каскад: public.users (0003) и всё, что на него ссылается.
  delete from auth.users u where u.id = account;
end;
$$;

revoke all on function private.delete_account_of_caller() from public, anon;
grant execute on function private.delete_account_of_caller() to authenticated;

create or replace function public.delete_my_account()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.delete_account_of_caller();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'DSGVO ст. 17: удаляет аккаунт вызывающего и всё, что с ним связано. Файлы Storage приложение удаляет до вызова.';
