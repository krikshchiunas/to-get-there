import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  dateErrorOf,
  dateLabel,
  draftFrom,
  isDraftEmpty,
  placeErrorOf,
  placeLabel,
  relaxHint,
  timeErrorOf,
  timeLabel,
  toFilters,
  toMinutes,
  toPlaceMode,
  type FilterDraft,
} from "./search-draft";
import { emptyFilters, type SearchFilters } from "./types";

const empty = draftFrom(emptyFilters);
const now = new Date("2026-10-20T10:00:00Z");

describe("toMinutes / toPlaceMode", () => {
  it("время — в минуты от полуночи", () => {
    expect(toMinutes("18:30")).toBe(1110);
    expect(toMinutes("7:05")).toBe(425);
    expect(toMinutes("24:00")).toBeNull();
    expect(toMinutes("12:60")).toBeNull();
    expect(toMinutes("")).toBeNull();
  });

  it("режим места — только известные значения", () => {
    expect(toPlaceMode("area")).toBe("area");
    expect(toPlaceMode("nowhere")).toBe("any");
  });
});

describe("draftFrom ↔ toFilters", () => {
  it("пустые фильтры — пустой черновик и обратно", () => {
    expect(isDraftEmpty(empty)).toBe(true);
    expect(toFilters(empty, emptyFilters)).toEqual(emptyFilters);
  });

  it("один день, окно времени и город переживают круг туда-обратно", () => {
    const filters: SearchFilters = {
      ...emptyFilters,
      query: "квиз",
      date_from: "2026-10-24",
      date_to: "2026-10-24",
      time_window: { from_minutes: 18 * 60, to_minutes: 23 * 60 },
      geo_mode: "city",
      geo_city: "Берлин",
    };
    const draft = draftFrom(filters);
    expect(draft).toMatchObject({ dateMode: "day", day: "2026-10-24", timeFrom: "18:00", timeTo: "23:00" });
    expect(isDraftEmpty(draft)).toBe(false);
    expect(toFilters(draft, filters)).toEqual(filters);
  });

  it("диапазон дат и радиус", () => {
    const filters: SearchFilters = {
      ...emptyFilters,
      date_from: "2026-10-24",
      date_to: "2026-10-26",
      geo_mode: "radius",
      geo_radius_m: 5000,
    };
    const draft = draftFrom(filters);
    expect(draft).toMatchObject({
      dateMode: "range",
      dateFrom: "2026-10-24",
      dateTo: "2026-10-26",
      radius: 5000,
    });
    expect(toFilters(draft, emptyFilters)).toEqual(filters);
  });

  it("область на карте: точка и радиус уходят в фильтры, в других режимах — нет", () => {
    const point = { lat: 52.5, lng: 13.4 };
    const area: FilterDraft = { ...empty, placeMode: "area", radius: 1000, point };
    expect(toFilters(area, emptyFilters)).toMatchObject({
      geo_mode: "area",
      geo_radius_m: 1000,
      geo_point: point,
    });
    expect(toFilters({ ...area, placeMode: "city", city: "Берлин" }, emptyFilters)).toMatchObject({
      geo_point: null,
      geo_radius_m: null,
    });
  });

  it("недописанные день и диапазон не превращаются в фильтр", () => {
    expect(toFilters({ ...empty, dateMode: "day" }, emptyFilters)).toMatchObject({
      date_from: null,
      date_to: null,
    });
    expect(toFilters({ ...empty, dateMode: "range", dateFrom: "2026-10-24" }, emptyFilters)).toMatchObject({
      date_from: "2026-10-24",
      date_to: null,
    });
  });
});

describe("ошибки секций", () => {
  it("дата «по» раньше «с»", () => {
    expect(
      dateErrorOf({ ...empty, dateMode: "range", dateFrom: "2026-10-26", dateTo: "2026-10-24" }),
    ).toMatch(/раньше/);
    expect(dateErrorOf({ ...empty, dateMode: "range", dateFrom: "2026-10-24" })).toBeNull();
    expect(dateErrorOf({ ...empty, dateMode: "day", day: "2026-10-24" })).toBeNull();
  });

  it("окно времени: один конец или пустое окно", () => {
    expect(timeErrorOf(empty)).toBeNull();
    expect(timeErrorOf({ ...empty, timeFrom: "18:00" })).toMatch(/оба конца/);
    expect(timeErrorOf({ ...empty, timeFrom: "18:00", timeTo: "18:00" })).toMatch(/пустое/);
    expect(timeErrorOf({ ...empty, timeFrom: "18:00", timeTo: "23:00" })).toBeNull();
  });

  it("место: город не выбран, у области нет точки", () => {
    expect(placeErrorOf({ ...empty, placeMode: "city" })).toMatch(/город/);
    expect(placeErrorOf({ ...empty, placeMode: "area" })).toMatch(/карту/);
    expect(placeErrorOf({ ...empty, placeMode: "area", point: { lat: 1, lng: 2 } })).toBeNull();
  });
});

describe("сводка и подсказки", () => {
  it("число включённых фильтров листа", () => {
    expect(activeFilterCount(emptyFilters)).toBe(0);
    expect(
      activeFilterCount({
        ...emptyFilters,
        date_to: "2026-10-24",
        time_window: { from_minutes: 0, to_minutes: 60 },
        geo_mode: "city",
      }),
    ).toBe(3);
  });

  it("подписи даты", () => {
    expect(dateLabel(emptyFilters, now)).toBeNull();
    expect(dateLabel({ ...emptyFilters, date_from: "2026-10-20", date_to: "2026-10-20" }, now)).toBe(
      "Сегодня",
    );
    expect(dateLabel({ ...emptyFilters, date_from: "2026-10-20", date_to: "2026-10-22" }, now)).toMatch(
      /^Сегодня – /,
    );
    expect(dateLabel({ ...emptyFilters, date_from: "2026-10-22" }, now)).toMatch(/^с /);
    expect(dateLabel({ ...emptyFilters, date_to: "2026-10-22" }, now)).toMatch(/^по /);
  });

  it("подписи места и времени", () => {
    expect(placeLabel(emptyFilters)).toBeNull();
    expect(placeLabel({ ...emptyFilters, geo_mode: "radius", geo_radius_m: 2000 })).toBe("2 км вокруг меня");
    expect(placeLabel({ ...emptyFilters, geo_mode: "radius" })).toBeNull();
    expect(placeLabel({ ...emptyFilters, geo_mode: "area", geo_radius_m: 500 })).toBe(
      "500 м вокруг точки на карте",
    );
    expect(placeLabel({ ...emptyFilters, geo_mode: "area" })).toBeNull();
    expect(placeLabel({ ...emptyFilters, geo_mode: "city", geo_city: "Кёльн" })).toBe("Кёльн");
    expect(timeLabel(emptyFilters)).toBeNull();
    expect(timeLabel({ ...emptyFilters, time_window: { from_minutes: 360, to_minutes: 720 } })).toBe(
      "06:00–12:00",
    );
  });

  it("что ослабить первым — от самого узкого к самому широкому", () => {
    const all: SearchFilters = {
      ...emptyFilters,
      date_from: "2026-10-24",
      time_window: { from_minutes: 360, to_minutes: 720 },
      geo_mode: "radius",
      geo_radius_m: 1000,
      category_ids: ["sport"],
    };
    expect(relaxHint(all)).toMatch(/дата/);
    expect(relaxHint({ ...all, date_from: null })).toMatch(/06:00/);
    expect(relaxHint({ ...all, date_from: null, time_window: null })).toMatch(/1 км/);
    expect(relaxHint({ ...all, date_from: null, time_window: null, geo_mode: "area" })).toMatch(/1 км/);
    expect(
      relaxHint({ ...all, date_from: null, time_window: null, geo_mode: "city", geo_city: "Кёльн" }),
    ).toMatch(/Кёльн/);
    expect(relaxHint({ ...all, date_from: null, time_window: null, geo_mode: null })).toMatch(/категорий/);
    expect(relaxHint(emptyFilters)).toMatch(/другое слово/);
  });
});
