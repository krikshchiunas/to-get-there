-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0039 — гонка за последнее место                                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- can_join_post() (0007, 0029) считает участников в снимке запроса. Два
-- одновременных «Присоединиться» на одно последнее место видят одно и то же
-- «осталось 1» — и проходят оба: в идее «7 из 6».
--
-- Теперь вступления в одну идею выстраиваются в очередь: триггер берёт
-- транзакционную блокировку по id идеи и пересчитывает места уже под ней.
-- В READ COMMITTED запрос после блокировки видит строку, которую успела
-- записать предыдущая транзакция, — второй получает «мест нет».
-- Блокировка — на идею, а не на таблицу: вступления в разные идеи друг
-- друга не ждут.

create or replace function private.lock_post_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  capacity integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('post_seat:' || new.post_id::text, 0));

  select p.max_participants into capacity from public.posts p where p.id = new.post_id;
  if capacity is not null and private.participant_count(new.post_id) >= capacity then
    raise exception 'post % is full', new.post_id
      using errcode = '42501', hint = 'post_full';
  end if;

  return new;
end;
$$;

revoke all on function private.lock_post_seat() from public, anon, authenticated;

-- Только для вступлений самих пользователей: сид и автор, которого сажает
-- триггер при создании идеи, идут не под authenticated или уже учтены.
drop trigger if exists post_participants_lock_seat on public.post_participants;
create trigger post_participants_lock_seat
  before insert on public.post_participants
  for each row when (current_user = 'authenticated')
  execute function private.lock_post_seat();
