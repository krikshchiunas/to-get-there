-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0021 — где находится кампус                                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- «Рядом со мной» нужна точка отсчёта. Раньше ею была константа в коде —
-- TU Berlin для всех, и студент из Мюнхена искал бы «в радиусе 2 км» от
-- Шарлоттенбурга. Теперь по умолчанию это главный кампус своего
-- университета, а точнее — геолокация браузера, если человек разрешил.
--
-- Координаты — главный корпус, с точностью до квартала. Это публичные
-- адреса университетов, не данные людей.

alter table public.universities
  add column if not exists campus_lat double precision,
  add column if not exists campus_lng double precision;

alter table public.universities
  drop constraint if exists universities_campus_pair,
  add constraint universities_campus_pair check ((campus_lat is null) = (campus_lng is null)),
  drop constraint if exists universities_campus_range,
  add constraint universities_campus_range check (
    campus_lat is null or (campus_lat between -90 and 90 and campus_lng between -180 and 180)
  );

update public.universities set campus_lat = v.lat, campus_lng = v.lng
from (values
  ('tu-berlin.de',    52.5125, 13.3269),
  ('hu-berlin.de',    52.5180, 13.3934),
  ('fu-berlin.de',    52.4524, 13.2899),
  ('lmu.de',          48.1508, 11.5805),
  ('uni-hamburg.de',  53.5668,  9.9847),
  ('rwth-aachen.de',  50.7779,  6.0778),
  ('kit.edu',         49.0094,  8.4120),
  ('uni-koeln.de',    50.9281,  6.9289)
) as v(domain, lat, lng)
where universities.domain = v.domain;
