/**
 * Правила поиска — чистые функции над уже загруженными списками.
 *
 * Один и тот же код фильтрует и моковый набор, и то, что пришло из базы,
 * поэтому результат совпадает в обоих режимах. Модуль не знает ни про
 * Supabase, ни про моки, и потому работает и на сервере, и в браузере.
 */

import { distanceMetres, isInFeed, minutesOfDay } from "./format";
import type { PostView, SearchFilters, UserView } from "./types";

/** Где стоит зритель — для фильтра «радиус вокруг меня». */
export { viewerLocation } from "./access";
import { viewerLocation } from "./access";

export function filterPosts(posts: PostView[], filters: SearchFilters, now: Date): PostView[] {
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

    const day = post.date_start.slice(0, 10);
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

    if (filters.geo_mode === "radius" && filters.geo_radius_m) {
      if (post.geo_lat == null || post.geo_lng == null) return false;
      const metres = distanceMetres(viewerLocation, { lat: post.geo_lat, lng: post.geo_lng });
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
    return [user.nickname, user.faculty ?? "", user.university.short_name, ...user.interests]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}
