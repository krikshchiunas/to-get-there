-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0015 — голос в опросе через cast_vote()                              ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- upsert из PostgREST превращается в
--   insert ... on conflict (poll_id, user_id)
--   do update set poll_id = excluded.poll_id, user_id = ..., option_index = ...
-- то есть обновляет все переданные колонки. У authenticated есть UPDATE
-- только на option_index (0008), поэтому любой голос падал с 42501.
--
-- Расширять права на poll_id/user_id нельзя: политика UPDATE не проверяет
-- членство, и голос можно было бы перенести в чужой опрос. Вместо этого —
-- функция, которая при конфликте трогает только option_index.
--
-- security invoker: работают обычные политики poll_votes_insert_member и
-- poll_votes_update_own, функция ничего не обходит.

create or replace function public.cast_vote(poll uuid, option_index integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.poll_votes (poll_id, user_id, option_index)
  values (poll, public.current_user_id(), cast_vote.option_index)
  on conflict (poll_id, user_id)
    do update set option_index = excluded.option_index;
$$;

comment on function public.cast_vote(uuid, integer) is
  'Голос текущего пользователя в опросе; повторный вызов меняет вариант. Права проверяет RLS.';

revoke all on function public.cast_vote(uuid, integer) from public, anon;
grant execute on function public.cast_vote(uuid, integer) to authenticated;
