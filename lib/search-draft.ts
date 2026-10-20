/**
 * Фильтры поиска идей: черновик листа «Фильтры», его проверка и подписи,
 * которыми экран пересказывает, что сейчас сужает поиск. Без React —
 * правила покрываются тестами (lib/search-draft.test.ts).
 *
 * Всё, что собирает лист, правится в черновике и попадает в фильтры только
 * по «Применить фильтры» — недописанная дата не опустошает список за листом.
 * Фильтра «личность подтверждена» нет намеренно: проверка не даёт прав
 * нигде в приложении, значит, не сортирует и не прячет результаты.
 */

import { formatDayLabel, formatMinutesOfDay, formatRadius } from "@/lib/format";
import type { GeoMode, GeoRadius, SearchFilters } from "@/lib/types";

export type DateMode = "any" | "day" | "range";
export type PlaceMode = "any" | GeoMode;
type Point = { lat: number; lng: number };

export const SEARCH_RADII: readonly GeoRadius[] = [500, 1000, 2000, 5000, 10000];

/** Готовые окна рядом с ручным вводом, в минутах от полуночи. */
export const TIME_PRESETS: ReadonlyArray<{ id: string; label: string; from: number; to: number }> = [
  { id: "morning", label: "Утро", from: 6 * 60, to: 12 * 60 },
  { id: "afternoon", label: "День", from: 12 * 60, to: 18 * 60 },
  { id: "evening", label: "Вечер", from: 18 * 60, to: 23 * 60 },
];

export interface FilterDraft {
  dateMode: DateMode;
  day: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  placeMode: PlaceMode;
  radius: GeoRadius;
  city: string;
  /** Область на карте: центр круга. */
  point: Point | null;
}

/** «18:30» → 1110; всё, что не время, — null. */
export function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function toPlaceMode(raw: string): PlaceMode {
  if (raw === "radius" || raw === "area" || raw === "city") return raw;
  return "any";
}

export function draftFrom(filters: SearchFilters): FilterDraft {
  const singleDay = filters.date_from !== null && filters.date_from === filters.date_to;
  const dateMode: DateMode =
    filters.date_from === null && filters.date_to === null ? "any" : singleDay ? "day" : "range";
  const window = filters.time_window;

  return {
    dateMode,
    day: dateMode === "day" ? (filters.date_from ?? "") : "",
    dateFrom: dateMode === "range" ? (filters.date_from ?? "") : "",
    dateTo: dateMode === "range" ? (filters.date_to ?? "") : "",
    timeFrom: window ? formatMinutesOfDay(window.from_minutes) : "",
    timeTo: window ? formatMinutesOfDay(window.to_minutes) : "",
    placeMode: filters.geo_mode ?? "any",
    radius: filters.geo_radius_m ?? 2000,
    city: filters.geo_city ?? "",
    point: filters.geo_point,
  };
}

/** Ничего не выбрано — кнопке «Сбросить» нечего сбрасывать. */
export function isDraftEmpty(draft: FilterDraft): boolean {
  return draft.dateMode === "any" && !draft.timeFrom && !draft.timeTo && draft.placeMode === "any";
}

export function dateErrorOf(draft: FilterDraft): string | null {
  if (draft.dateMode !== "range") return null;
  if (!draft.dateFrom || !draft.dateTo) return null;
  if (draft.dateTo < draft.dateFrom) {
    return "Дата «по» раньше даты «с». Сдвинь одну из них, чтобы диапазон шёл вперёд.";
  }
  return null;
}

export function timeErrorOf(draft: FilterDraft): string | null {
  if (!draft.timeFrom && !draft.timeTo) return null;
  const from = toMinutes(draft.timeFrom);
  const to = toMinutes(draft.timeTo);
  if (from === null || to === null) return "Заполни оба конца окна: с какого и по какое время.";
  if (to <= from) return "Окно пустое: время «по» должно быть позже, чем «с».";
  return null;
}

export function placeErrorOf(draft: FilterDraft): string | null {
  if (draft.placeMode === "city" && !draft.city) return "Выбери город из списка.";
  if (draft.placeMode === "area" && !draft.point) return "Сдвинь карту так, чтобы круг лёг на нужное место.";
  return null;
}

/** Черновик — обратно в фильтры, по которым ищет экран. */
export function toFilters(draft: FilterDraft, base: SearchFilters): SearchFilters {
  const timeFrom = toMinutes(draft.timeFrom);
  const timeTo = toMinutes(draft.timeTo);

  const dates: Pick<SearchFilters, "date_from" | "date_to"> =
    draft.dateMode === "day"
      ? { date_from: draft.day || null, date_to: draft.day || null }
      : draft.dateMode === "range"
        ? { date_from: draft.dateFrom || null, date_to: draft.dateTo || null }
        : { date_from: null, date_to: null };

  const circle = draft.placeMode === "radius" || draft.placeMode === "area";
  return {
    ...base,
    ...dates,
    time_window: timeFrom !== null && timeTo !== null ? { from_minutes: timeFrom, to_minutes: timeTo } : null,
    geo_mode: draft.placeMode === "any" ? null : draft.placeMode,
    geo_radius_m: circle ? draft.radius : null,
    geo_city: draft.placeMode === "city" && draft.city ? draft.city : null,
    geo_point: draft.placeMode === "area" ? draft.point : null,
  };
}

/** Сколько фильтров листа включено — число на чипе «Фильтры». */
export function activeFilterCount(filters: SearchFilters): number {
  let count = 0;
  if (filters.date_from !== null || filters.date_to !== null) count += 1;
  if (filters.time_window !== null) count += 1;
  if (filters.geo_mode !== null) count += 1;
  return count;
}

/* ── подписи ───────────────────────────────────────────────────────── */

/** «с 24 окт.», «Сегодня», «Сегодня – Сб, 24 окт.» */
export function dateLabel(filters: SearchFilters, now: Date): string | null {
  const label = (iso: string) => formatDayLabel(`${iso}T12:00:00`, now);
  const { date_from: from, date_to: to } = filters;

  if (from && to) return from === to ? label(from) : `${label(from)} – ${label(to)}`;
  if (from) return `с ${label(from)}`;
  if (to) return `по ${label(to)}`;
  return null;
}

export function placeLabel(filters: SearchFilters): string | null {
  switch (filters.geo_mode) {
    case "radius":
      return filters.geo_radius_m === null ? null : `${formatRadius(filters.geo_radius_m)} вокруг меня`;
    case "area":
      return filters.geo_radius_m === null
        ? null
        : `${formatRadius(filters.geo_radius_m)} вокруг точки на карте`;
    case "city":
      return filters.geo_city;
    default:
      return null;
  }
}

export function timeLabel(filters: SearchFilters): string | null {
  const window = filters.time_window;
  return window
    ? `${formatMinutesOfDay(window.from_minutes)}–${formatMinutesOfDay(window.to_minutes)}`
    : null;
}

/** Что ослабить первым, когда ничего не нашлось. */
export function relaxHint(filters: SearchFilters): string {
  if (filters.date_from !== null || filters.date_to !== null) {
    return "Самое узкое здесь — дата. Возьми диапазон пошире или сними её совсем.";
  }
  if (filters.time_window !== null) {
    const { from_minutes: from, to_minutes: to } = filters.time_window;
    return `В окне с ${formatMinutesOfDay(from)} до ${formatMinutesOfDay(to)} ничего нет. Убери время суток или раздвинь окно.`;
  }
  if ((filters.geo_mode === "radius" || filters.geo_mode === "area") && filters.geo_radius_m !== null) {
    return `Внутри ${formatRadius(filters.geo_radius_m)} пусто. Возьми радиус побольше или укажи город.`;
  }
  if (filters.geo_mode === "city" && filters.geo_city !== null) {
    return `В ${filters.geo_city} сейчас ничего нет. Попробуй другой город или сними фильтр места.`;
  }
  if (filters.category_ids.length > 0) {
    return "Сними часть категорий — так в результаты попадёт больше идей.";
  }
  return "Поиск смотрит название, описание, место, категорию и ник автора. Попробуй другое слово.";
}
