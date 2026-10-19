-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0019 — документы для верификации у себя не храним                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- 0009 завела бакет verification под фото документа и селфи. Но экран
-- верификации обещает обратное: файлы уходят провайдеру проверки, а
-- приложение получает только ответ «да» или «нет». Так и сделано (0020,
-- Stripe Identity): документ и селфи собирает сам провайдер на своей
-- странице. Хранить сканы паспортов у себя — лишний риск и лишняя
-- ответственность по GDPR, без всякой пользы.
--
-- Политики снимаются всегда — без них в бакет нельзя ни положить, ни
-- прочитать. Сам бакет удаляется, если Storage это позволяет (на части
-- проектов прямое удаление из storage.buckets запрещено триггером — тогда
-- он остаётся пустым и закрытым, удалить можно в панели Supabase).

drop policy if exists verification_read_own   on storage.objects;
drop policy if exists verification_insert_own on storage.objects;
drop policy if exists verification_delete_own on storage.objects;

do $$
begin
  if not exists (select 1 from storage.objects where bucket_id = 'verification') then
    delete from storage.buckets where id = 'verification';
  end if;
exception
  when others then
    raise notice 'storage.buckets: бакет verification оставлен пустым и без политик (%).', sqlerrm;
end
$$;
