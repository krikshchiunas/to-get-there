import { describe, expect, it } from "vitest";
import { campusPlace, isValidCoord, roundCoord, zoomForRadius } from "./place";

describe("campusPlace", () => {
  it("берёт кампус своего университета", () => {
    const place = campusPlace({ short_name: "LMU", campus_lat: 48.1508, campus_lng: 11.5805 });
    expect(place).toEqual({ lat: 48.1508, lng: 11.5805, label: "Кампус LMU", source: "campus" });
  });

  it("без координат не падает, а берёт запасную точку", () => {
    const place = campusPlace({ short_name: "X", campus_lat: null, campus_lng: null });
    expect(isValidCoord(place.lat, place.lng)).toBe(true);
  });
});

describe("roundCoord", () => {
  it("огрубляет до километра и до сотни метров", () => {
    expect(roundCoord(52.512345, 2)).toBe(52.51);
    expect(roundCoord(13.326987, 3)).toBe(13.327);
    expect(roundCoord(-0.004999, 2)).toBe(-0);
  });
});

describe("isValidCoord", () => {
  it("отклоняет мусор и выход за пределы", () => {
    expect(isValidCoord(52.5, 13.4)).toBe(true);
    expect(isValidCoord(91, 0)).toBe(false);
    expect(isValidCoord(0, 181)).toBe(false);
    expect(isValidCoord(Number.NaN, 0)).toBe(false);
    expect(isValidCoord("52", 13)).toBe(false);
    expect(isValidCoord(null, null)).toBe(false);
  });
});

describe("zoomForRadius", () => {
  it("чем больше круг, тем мельче масштаб", () => {
    expect([500, 1000, 2000, 5000, 10000].map(zoomForRadius)).toEqual([15, 14, 13, 12, 11]);
  });
});
