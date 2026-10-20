import { describe, expect, it } from "vitest";
import { filterPosts, filterUsers } from "./search-filter";
import { users } from "./mock";
import type { PostView, SearchFilters } from "./types";

const NOW = new Date("2026-10-19T10:00:00Z");

function post(id: string, patch: Partial<PostView>): PostView {
  return {
    id,
    title: id,
    description: "",
    geo_city: "Берлин",
    geo_address: null,
    geo_lat: null,
    geo_lng: null,
    category_id: "c",
    category: { name: "Спорт" },
    author: { nickname: "a" },
    is_closed: false,
    date_start: "2026-10-20T16:00:00Z",
    ...patch,
  } as PostView;
}

const none: SearchFilters = {
  query: "",
  category_ids: [],
  date_from: null,
  date_to: null,
  time_window: null,
  geo_mode: null,
  geo_radius_m: null,
  geo_city: null,
  geo_point: null,
} as unknown as SearchFilters;

describe("filterPosts — радиус", () => {
  const munich = { lat: 48.1508, lng: 11.5805 };
  const posts = [
    post("near-munich", { geo_lat: 48.15, geo_lng: 11.58 }),
    post("berlin", { geo_lat: 52.51, geo_lng: 13.33 }),
    post("no-point", {}),
  ];
  const radius = { ...none, geo_mode: "radius", geo_radius_m: 2000 } as SearchFilters;

  it("считает от точки зрителя, а не от одной на всех", () => {
    expect(filterPosts(posts, radius, NOW, munich).map((p) => p.id)).toEqual(["near-munich"]);
  });

  it("без точки отсчёта радиус ничего не отбирает", () => {
    expect(filterPosts(posts, radius, NOW, null)).toEqual([]);
  });
});

describe("filterPosts — область на карте", () => {
  const posts = [
    post("kreuzberg", { geo_lat: 52.4986, geo_lng: 13.4033 }),
    post("charlottenburg", { geo_lat: 52.5167, geo_lng: 13.3041 }),
  ];
  const area = {
    ...none,
    geo_mode: "area",
    geo_radius_m: 1000,
    geo_point: { lat: 52.499, lng: 13.41 },
  } as SearchFilters;

  it("круг — от выбранной точки, а не от зрителя", () => {
    const farAway = { lat: 48.15, lng: 11.58 };
    expect(filterPosts(posts, area, NOW, farAway).map((p) => p.id)).toEqual(["kreuzberg"]);
  });

  it("без точки область не отбирает ничего", () => {
    expect(filterPosts(posts, { ...area, geo_point: null }, NOW, null)).toEqual([]);
  });
});

describe("filterPosts — день по Берлину", () => {
  // 00:30 по Берлину 21 октября = 22:30 UTC 20 октября.
  const lateNight = post("late", { date_start: "2026-10-20T22:30:00Z" });

  it("идея в 00:30 относится к своему дню, а не к вчерашнему по UTC", () => {
    const on21 = { ...none, date_from: "2026-10-21", date_to: "2026-10-21" } as SearchFilters;
    const on20 = { ...none, date_from: "2026-10-20", date_to: "2026-10-20" } as SearchFilters;
    expect(filterPosts([lateNight], on21, NOW, null)).toHaveLength(1);
    expect(filterPosts([lateNight], on20, NOW, null)).toHaveLength(0);
  });
});

describe("filterPosts — слово, категория, время, город", () => {
  const now = new Date("2026-10-24T10:00:00Z");
  const base = post("a", {
    title: "Пиво у канала",
    geo_city: "Berlin",
    category_id: "party",
    date_start: "2026-10-24T18:00:00Z",
  });
  const quiz = post("b", {
    title: "Паб-квиз",
    geo_city: "Leipzig",
    category_id: "games",
    date_start: "2026-10-25T08:00:00Z",
  });

  it("ищет по названию без учёта регистра", () => {
    const result = filterPosts([base, quiz], { ...none, query: "КВИЗ" }, now, null);
    expect(result.map((post) => post.id)).toEqual(["b"]);
  });

  it("окно времени суток", () => {
    const evening = { from_minutes: 18 * 60, to_minutes: 23 * 60 };
    const result = filterPosts([base, quiz], { ...none, time_window: evening }, now, null);
    expect(result.map((post) => post.id)).toEqual(["a"]);
  });

  it("город — без учёта регистра и пробелов", () => {
    const result = filterPosts([base, quiz], { ...none, geo_mode: "city", geo_city: " leipzig " }, now, null);
    expect(result.map((post) => post.id)).toEqual(["b"]);
  });

  it("категории", () => {
    const result = filterPosts([base, quiz], { ...none, category_ids: [quiz.category_id] }, now, null);
    expect(result.map((post) => post.id)).toEqual(["b"]);
  });

  it("результат — ближайшее первым", () => {
    const result = filterPosts([quiz, base], none, now, null);
    expect(result.map((post) => post.id)).toEqual(["a", "b"]);
  });
});

describe("filterUsers", () => {
  it("пустой запрос — никого; скрытых из поиска и себя — нет", () => {
    const visible = {
      ...users[1],
      privacy_settings: { ...users[1].privacy_settings, visible_in_search: true },
    };
    const hidden = {
      ...users[2],
      privacy_settings: { ...users[2].privacy_settings, visible_in_search: false },
    };
    expect(filterUsers([visible, hidden], "  ", "me")).toEqual([]);
    expect(filterUsers([visible, hidden], visible.nickname, "me")).toEqual([visible]);
    expect(filterUsers([visible, hidden], hidden.nickname, "me")).toEqual([]);
    expect(filterUsers([visible], visible.nickname, visible.id)).toEqual([]);
  });
});
