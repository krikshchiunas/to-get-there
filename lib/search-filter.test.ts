import { describe, expect, it } from "vitest";
import { filterPosts } from "./search-filter";
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
