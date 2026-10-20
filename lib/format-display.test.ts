import { describe, expect, it } from "vitest";
import {
  dayKey,
  distanceMetres,
  feedExitReason,
  formatCount,
  formatDateTime,
  formatDayLabel,
  formatDayLong,
  formatMinutesOfDay,
  formatParticipants,
  formatPlaces,
  formatRadius,
  formatRelative,
  formatSeats,
  formatStamp,
  formatTime,
  initialsOf,
  isFull,
  minutesOfDay,
  seatsLeft,
  shortPlace,
  toDatetimeLocal,
  urgencyOf,
} from "./format";

// 24 октября 2026, 20:00 по Берлину (летнее время, UTC+2).
const evening = "2026-10-24T18:00:00Z";
const now = new Date("2026-10-24T10:00:00Z"); // 12:00 по Берлину

describe("время и дни — всегда по Берлину", () => {
  it("formatTime и minutesOfDay", () => {
    expect(formatTime(evening)).toBe("20:00");
    expect(minutesOfDay(evening)).toBe(20 * 60);
  });

  it("dayKey — день по Берлину, а не по UTC", () => {
    // 23:30 UTC 24-го — это уже 01:30 25-го в Берлине.
    expect(dayKey("2026-10-24T23:30:00Z")).toBe("2026-10-25");
  });

  it("formatDayLabel: сегодня, завтра, вчера и дальше", () => {
    expect(formatDayLabel(evening, now)).toBe("Сегодня");
    expect(formatDayLabel("2026-10-25T10:00:00Z", now)).toBe("Завтра");
    expect(formatDayLabel("2026-10-23T10:00:00Z", now)).toBe("Вчера");
    expect(formatDayLabel("2026-10-28T10:00:00Z", now)).toMatch(/^[А-Я]/);
  });

  it("formatDayLong и formatDateTime", () => {
    expect(formatDayLong(evening)).toMatch(/^Суббота, 24 октября/);
    expect(formatDateTime(evening)).toBe("24 октября, 20:00");
  });

  it("toDatetimeLocal — значение для поля формы по Берлину", () => {
    expect(toDatetimeLocal(evening)).toBe("2026-10-24T20:00");
  });

  it("formatMinutesOfDay", () => {
    expect(formatMinutesOfDay(0)).toBe("00:00");
    expect(formatMinutesOfDay(19 * 60 + 5)).toBe("19:05");
    expect(formatMinutesOfDay(24 * 60 + 30)).toBe("00:30");
  });
});

describe("срочность и относительное время", () => {
  it("urgencyOf — только «сейчас» и «скоро» горячие", () => {
    expect(urgencyOf("2026-10-24T09:00:00Z", now)).toBe("past");
    expect(urgencyOf("2026-10-24T10:20:00Z", now)).toBe("now");
    expect(urgencyOf("2026-10-24T12:00:00Z", now)).toBe("soon");
    expect(urgencyOf(evening, now)).toBe("today");
    expect(urgencyOf("2026-10-27T10:00:00Z", now)).toBe("later");
  });

  it("formatRelative", () => {
    expect(formatRelative("2026-10-24T10:00:20Z", now)).toBe("сейчас");
    expect(formatRelative("2026-10-24T10:25:00Z", now)).toBe("через 25 мин.");
    expect(formatRelative("2026-10-24T13:00:00Z", now)).toBe("через 3 ч.");
    expect(formatRelative("2026-10-26T10:00:00Z", now)).toBe("через 2 дня");
    expect(formatRelative("2026-10-24T09:50:00Z", now)).toBe("10 мин. назад");
  });

  it("formatStamp — время сегодня, «Вчера, …» и день недели дальше", () => {
    expect(formatStamp(evening, now)).toBe("20:00");
    expect(formatStamp("2026-10-23T18:00:00Z", now)).toBe("Вчера, 20:00");
    expect(formatStamp("2026-10-20T18:00:00Z", now)).toMatch(/, 20:00$/);
  });
});

describe("правила ленты и места", () => {
  it("feedExitReason", () => {
    expect(feedExitReason({ is_closed: true, date_start: evening }, now)).toBe("closed");
    expect(feedExitReason({ is_closed: false, date_start: "2026-10-24T08:00:00Z" }, now)).toBe("over");
    expect(feedExitReason({ is_closed: false, date_start: evening }, now)).toBeNull();
  });

  it("seatsLeft и isFull", () => {
    expect(seatsLeft({ max_participants: null }, 10)).toBeNull();
    expect(seatsLeft({ max_participants: 5 }, 3)).toBe(2);
    expect(seatsLeft({ max_participants: 5 }, 7)).toBe(0);
    expect(isFull({ max_participants: 5 }, 5)).toBe(true);
    expect(isFull({ max_participants: null }, 500)).toBe(false);
  });

  it("числа словами", () => {
    expect(formatRadius(500)).toBe("500 м");
    expect(formatRadius(2000)).toBe("2 км");
    expect(formatSeats(3, 5)).toBe("3 из 5");
    expect(formatSeats(3, null)).toBe("3");
    expect(formatParticipants(1)).toBe("1 участник");
    expect(formatParticipants(11)).toBe("11 участников");
    expect(formatPlaces(3)).toBe("3 места");
    expect(formatCount(14300)).toBe("14,3 тыс.");
  });

  it("shortPlace и initialsOf", () => {
    expect(shortPlace("Oberbaumbrücke, сторона Фридрихсхайна", "Berlin")).toBe("Oberbaumbrücke");
    expect(shortPlace(null, "Berlin")).toBe("Berlin");
    expect(initialsOf("jonas_k")).toBe("JK");
    expect(initialsOf("tobi")).toBe("TO");
    expect(initialsOf("___")).toBe("?");
  });

  it("distanceMetres — Бранденбургские ворота и Рейхстаг около 400 м", () => {
    const gate = { lat: 52.5163, lng: 13.3777 };
    const reichstag = { lat: 52.5186, lng: 13.3762 };
    expect(distanceMetres(gate, gate)).toBe(0);
    expect(distanceMetres(gate, reichstag)).toBeGreaterThan(250);
    expect(distanceMetres(gate, reichstag)).toBeLessThan(350);
  });
});
