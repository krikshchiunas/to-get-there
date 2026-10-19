-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0031 — ограничение частоты записей                                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Supabase ограничивает частоту входа и писем, но не записей в таблицы:
-- скрипт с чужим токеном мог бы залить чат тысячей сообщений в минуту или
-- разослать личные сообщения всем подряд. Ограничение стоит в базе, а не в
-- приложении, потому что API открыт напрямую — /rest/v1 обходит любые
-- проверки в server actions.
--
-- Пределы выбраны так, чтобы живой человек в них не упирался:
--   сообщение в чате идеи      20 в минуту
--   личное сообщение           20 в минуту, 40 разных собеседников за сутки
--   идея                       10 в час, 30 в сутки
--   голосование                10 в час
--   вступление в идею          30 в час
--   подписка                   100 в час
--   жалоба                     30 в сутки
--   блокировка                 100 в сутки
--
-- Отказ — SQLSTATE P0429 (по аналогии с HTTP 429); приложение переводит его
-- в «Слишком часто» (lib/actions/actor.ts).

create or replace function private.rate_limited(what text)
returns void
language plpgsql
as $$
begin
  raise exception 'rate limit: %', what
    using errcode = 'P0429', hint = 'Подожди немного и попробуй снова.';
end;
$$;

revoke all on function private.rate_limited(text) from public, anon, authenticated;

create or replace function private.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  case tg_table_name
    when 'messages' then
      if (select count(*) from public.messages m
          where m.author_id = new.author_id and m.created_at > now() - interval '1 minute') >= 20 then
        perform private.rate_limited('messages');
      end if;

    when 'direct_messages' then
      if (select count(*) from public.direct_messages d
          where d.sender_id = new.sender_id and d.created_at > now() - interval '1 minute') >= 20 then
        perform private.rate_limited('direct_messages');
      end if;
      -- Рассылка: новый собеседник сверх сорока за сутки.
      if not exists (
           select 1 from public.direct_messages d
           where d.sender_id = new.sender_id and d.receiver_id = new.receiver_id
             and d.created_at > now() - interval '1 day')
         and (select count(distinct d.receiver_id) from public.direct_messages d
              where d.sender_id = new.sender_id and d.created_at > now() - interval '1 day') >= 40 then
        perform private.rate_limited('direct_messages_recipients');
      end if;

    when 'posts' then
      if (select count(*) from public.posts p
          where p.author_id = new.author_id and p.created_at > now() - interval '1 hour') >= 10
         or (select count(*) from public.posts p
             where p.author_id = new.author_id and p.created_at > now() - interval '1 day') >= 30 then
        perform private.rate_limited('posts');
      end if;

    when 'polls' then
      if (select count(*) from public.polls p
          where p.created_by = new.created_by and p.created_at > now() - interval '1 hour') >= 10 then
        perform private.rate_limited('polls');
      end if;

    when 'post_participants' then
      if (select count(*) from public.post_participants pp
          where pp.user_id = new.user_id and pp.joined_at > now() - interval '1 hour') >= 30 then
        perform private.rate_limited('post_participants');
      end if;

    when 'follows' then
      if (select count(*) from public.follows f
          where f.follower_id = new.follower_id and f.created_at > now() - interval '1 hour') >= 100 then
        perform private.rate_limited('follows');
      end if;

    when 'reports' then
      if (select count(*) from public.reports r
          where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day') >= 30 then
        perform private.rate_limited('reports');
      end if;

    when 'user_blocks' then
      if (select count(*) from public.user_blocks b
          where b.blocker_id = new.blocker_id and b.created_at > now() - interval '1 day') >= 100 then
        perform private.rate_limited('user_blocks');
      end if;
  end case;

  return new;
end;
$$;

revoke all on function private.enforce_rate_limit() from public, anon, authenticated;

-- Только для запросов пользователей: сид, cron и вебхук идут не под
-- authenticated, и их пределы не касаются.
do $$
declare
  target text;
begin
  foreach target in array array[
    'messages', 'direct_messages', 'posts', 'polls', 'post_participants', 'follows', 'user_blocks'
  ] loop
    execute format('drop trigger if exists %I on public.%I', target || '_rate_limit', target);
    execute format(
      'create trigger %I before insert on public.%I
         for each row when (current_user = ''authenticated'')
         execute function private.enforce_rate_limit()',
      target || '_rate_limit', target
    );
  end loop;
end
$$;

-- У жалоб reporter_id ставит триггер reports_prepare. Триггеры BEFORE идут
-- по имени, поэтому лимит назван так, чтобы сработать после него.
drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit
  before insert on public.reports
  for each row when (current_user = 'authenticated')
  execute function private.enforce_rate_limit();

-- Индексы под подсчёт. Остальные таблицы уже покрыты (автор, время) из
-- 0005–0006; дубликат индекса сообщений по возрастанию не нужен — btree
-- читается в обе стороны.
create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);
create index if not exists reports_reporter_created_idx on public.reports (reporter_id, created_at desc);
create index if not exists user_blocks_blocker_created_idx on public.user_blocks (blocker_id, created_at desc);
drop index if exists public.messages_post_asc_idx;
