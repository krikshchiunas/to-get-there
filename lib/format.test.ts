import { describe, expect, it } from "vitest";
import {
  affiliationOf,
  berlinLocalToIso,
  formatCalendarDate,
  formatPresent,
  formatTime,
  formatTyping,
  isInFeed,
  pluralRu,
} from "./format";

describe("berlinLocalToIso — время из формы в абсолютное", () => {
  it("летом (CEST, +02:00) 19:30 по Берлину — это 17:30 UTC", () => {
    expect(berlinLocalToIso("2026-07-15T19:30")).toBe("2026-07-15T17:30:00.000Z");
  });

  it("зимой (CET, +01:00) 19:30 по Берлину — это 18:30 UTC", () => {
    expect(berlinLocalToIso("2026-12-15T19:30")).toBe("2026-12-15T18:30:00.000Z");
  });

  it("туда и обратно даёт то же берлинское время", () => {
    const iso = berlinLocalToIso("2026-10-20T19:30");
    expect(iso).not.toBeNull();
    expect(formatTime(iso!)).toBe("19:30");
  });

  it("на мусор отвечает null, а не неверной датой", () => {
    expect(berlinLocalToIso("")).toBeNull();
    expect(berlinLocalToIso("завтра вечером")).toBeNull();
  });
});

describe("isInFeed — правило ленты", () => {
  const now = new Date("2026-10-20T18:00:00Z");

  it("идея в будущем — в ленте", () => {
    expect(isInFeed({ is_closed: false, date_start: "2026-10-20T20:00:00Z" }, now)).toBe(true);
  });

  it("началась меньше часа назад — ещё в ленте", () => {
    expect(isInFeed({ is_closed: false, date_start: "2026-10-20T17:30:00Z" }, now)).toBe(true);
  });

  it("началась больше часа назад — уходит из ленты", () => {
    expect(isInFeed({ is_closed: false, date_start: "2026-10-20T16:30:00Z" }, now)).toBe(false);
  });

  it("закрытый набор уходит из ленты сразу, даже если впереди", () => {
    expect(isInFeed({ is_closed: true, date_start: "2026-10-21T20:00:00Z" }, now)).toBe(false);
  });
});

describe("pluralRu — три формы", () => {
  const forms: [string, string, string] = ["участник", "участника", "участников"];
  it.each([
    [1, "участник"],
    [2, "участника"],
    [4, "участника"],
    [5, "участников"],
    [11, "участников"],
    [12, "участников"],
    [14, "участников"],
    [21, "участник"],
    [22, "участника"],
    [25, "участников"],
    [101, "участник"],
    [111, "участников"],
  ])("%i — %s", (n, expected) => {
    expect(pluralRu(n, forms)).toBe(expected);
  });
});

describe("formatTyping", () => {
  it("один, двое, больше", () => {
    expect(formatTyping([])).toBeNull();
    expect(formatTyping(["jonas_k"])).toBe("jonas_k печатает…");
    expect(formatTyping(["jonas_k", "mira"])).toBe("jonas_k и mira печатают…");
    expect(formatTyping(["jonas_k", "mira", "tobi", "kwame"])).toBe("jonas_k, mira и ещё 2 печатают…");
  });
});

describe("formatPresent", () => {
  it("склоняет и молчит, когда никого", () => {
    expect(formatPresent(0)).toBeNull();
    expect(formatPresent(1)).toBe("Сейчас в чате ещё 1 человек");
    expect(formatPresent(3)).toBe("Сейчас в чате ещё 3 человека");
    expect(formatPresent(5)).toBe("Сейчас в чате ещё 5 человек");
  });
});

describe("affiliationOf — вуз и факультет, что из них есть", () => {
  const tu = { name: "Технический университет Берлина", short_name: "TU Berlin" };

  it("вуз и факультет", () => {
    expect(affiliationOf({ university: tu, faculty: "Информатика" })).toBe("TU Berlin · Информатика");
    expect(affiliationOf({ university: tu, faculty: null }, "name")).toBe("Технический университет Берлина");
  });

  it("без подтверждённого вуза — только факультет или пусто, без «null»", () => {
    expect(affiliationOf({ university: null, faculty: "Право" })).toBe("Право");
    expect(affiliationOf({ university: null, faculty: null })).toBe("");
  });
});

describe("formatCalendarDate", () => {
  it("число, месяц и год — без «г.», по Берлину", () => {
    expect(formatCalendarDate("2026-10-22T10:00:00Z")).toBe("22 октября 2026");
    // 23:30 UTC 31 декабря — в Берлине уже новый год.
    expect(formatCalendarDate("2026-12-31T23:30:00Z")).toBe("1 января 2027");
  });
});
