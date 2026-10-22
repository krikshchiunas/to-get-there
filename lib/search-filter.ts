/**
 * Правила поиска — чистые функции над уже загруженными списками.
 *
 * Один и тот же код фильтрует и моковый набор, и то, что пришло из базы,
 * поэтому результат совпадает в обоих режимах. Модуль не знает ни про
 * Supabase, ни про моки, и потому работает и на сервере, и в браузере.
 */

import { dayKey, distanceMetres, isInFeed, minutesOfDay } from "./format";
import type { PostView, SearchFilters, UserView } from "./types";

type Point = { lat: number; lng: number };

/**
 * Центр круга, внутри которого ищем: «вокруг меня» — от точки отсчёта,
 * «область на карте» — от выбранной точки. undefined — место не по кругу;
 * null — круг есть, а центра нет, и тогда честно не находится ничего.
 */
export function circleCenter(filters: SearchFilters, origin: Point | null): Point | null | undefined {
  if (filters.geo_mode === "radius") return origin;
  if (filters.geo_mode === "area") return filters.geo_point;
  return undefined;
}

/**
 * `origin` — откуда считать «радиус вокруг меня»: кампус или геолокация
 * (lib/use-place.ts). Без неё радиус не отбирает ничего — честнее, чем
 * считать от выдуманной точки.
 */
export function filterPosts(
  posts: PostView[],
  filters: SearchFilters,
  now: Date,
  origin: { lat: number; lng: number } | null,
): PostView[] {
  const needle = filters.query.trim().toLowerCase();

  const matched = posts.filter((post) => {
    if (!isInFeed(post, now)) return false;

    if (needle) {
      const haystack = [
        post.title,
        post.description,
        post.geo_city,
        post.geo_address ?? "",
        post.category.name,
        post.author.nickname,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (filters.category_ids.length && !filters.category_ids.includes(post.category_id)) {
      return false;
    }

    // День — по Берлину: идея в 00:30 относится к своему дню, а не к
    // вчерашнему по UTC.
    const day = dayKey(post.date_start);
    if (filters.date_from && day < filters.date_from) return false;
    if (filters.date_to && day > filters.date_to) return false;

    if (filters.time_window) {
      const minutes = minutesOfDay(post.date_start);
      if (minutes < filters.time_window.from_minutes) return false;
      if (minutes > filters.time_window.to_minutes) return false;
    }

    if (filters.geo_mode === "city" && filters.geo_city) {
      if (post.geo_city.toLowerCase() !== filters.geo_city.trim().toLowerCase()) return false;
    }

    const center = circleCenter(filters, origin);
    if (center !== undefined && filters.geo_radius_m) {
      if (!center || post.geo_lat == null || post.geo_lng == null) return false;
      const metres = distanceMetres(center, { lat: post.geo_lat, lng: post.geo_lng });
      if (metres > filters.geo_radius_m) return false;
    }

    return true;
  });

  // Хронологически: ближайшее первым, как в ленте.
  return matched.sort((a, b) => a.date_start.localeCompare(b.date_start));
}

/** Поиск людей учитывает privacy_settings.visible_in_search. */
export function filterUsers(users: UserView[], query: string, viewerId: string): UserView[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return users.filter((user) => {
    if (!user.privacy_settings.visible_in_search) return false;
    if (user.id === viewerId) return false;
    return [user.nickname, user.faculty ?? "", user.university?.short_name ?? "", ...user.interests]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}
