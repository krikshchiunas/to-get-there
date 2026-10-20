/**
 * Точка отсчёта для «рядом со мной» и для карты.
 *
 * По умолчанию — главный кампус своего университета (0021). Точнее —
 * геолокация браузера, если человек сам нажал «Определить точнее» и
 * разрешил. Чистые функции: работают и на сервере, и в браузере.
 */

import type { University } from "./types";

export interface Place {
  lat: number;
  lng: number;
  label: string;
  source: "campus" | "device";
}

/** Если у университета нет координат — центр его города не угадать; Берлин. */
const FALLBACK = { lat: 52.52, lng: 13.405 } as const;

export function campusPlace(university: Pick<University, "short_name" | "campus_lat" | "campus_lng">): Place {
  const known = university.campus_lat != null && university.campus_lng != null;
  return {
    lat: known ? university.campus_lat! : FALLBACK.lat,
    lng: known ? university.campus_lng! : FALLBACK.lng,
    label: `Кампус ${university.short_name}`,
    source: "campus",
  };
}

/**
 * Округление координаты. 3 знака — около 100 м: хватает для «в радиусе
 * 500 м» и не выдаёт подъезд. 2 знака — около 1 км: так хранятся идеи с
 * радиусом, которые видят все вошедшие.
 */
export function roundCoord(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Точность хранения идеи по режиму места (app/actions/posts.ts). */
export const STORED_DIGITS = { radius: 2, area: 4 } as const;

/** Размер «области» вокруг выбранной точки: место встречи где-то внутри. */
export const AREA_RADIUS_M = 250;

/** Масштаб карты, при котором круг такого радиуса в неё помещается. */
export function zoomForRadius(metres: number): number {
  if (metres <= 500) return 15;
  if (metres <= 1000) return 14;
  if (metres <= 2000) return 13;
  if (metres <= 5000) return 12;
  return 11;
}
