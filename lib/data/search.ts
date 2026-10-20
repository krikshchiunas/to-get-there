/**
 * Поиск.
 *
 * Текст и категории отбирает база, а окно времени суток и радиус считаются
 * в коде: первое требует арифметики по часовому поясу, второе — расстояния.
 * Честный вариант для радиуса — postgis или earthdistance, он отложен
 * (docs/ROADMAP.md, «что сознательно отложено»).
 */

import { createClient } from "@/lib/supabase/server";
import { berlinLocalToIso, DAY_MS, distanceMetres, FEED_GRACE_MS, minutesOfDay } from "@/lib/format";
import type { PostView, SearchFilters, UserView } from "@/lib/types";
import { POST_SELECT, toPostViews, type PostRow } from "./feed";
import { toUserViews } from "./people";
import type { Tables } from "@/lib/database.types";

/** PostgREST-фильтр `or` ломается на запятых и скобках внутри значения. */
function escapeForOr(value: string): string {
  return value.replace(/[,().*]/g, " ").trim();
}

/** Начало дня по Берлину, `YYYY-MM-DD` → ISO. */
function berlinDayStart(day: string): string | null {
  return berlinLocalToIso(`${day}T00:00`);
}

/** Сколько ближайших идей берёт поиск. */
export const SEARCH_POSTS_LIMIT = 500;

export async function searchPosts(
  filters: SearchFilters,
  now: Date,
  origin: { lat: number; lng: number } | null = null,
): Promise<PostView[]> {
  const supabase = await createClient();
  const cutoff = new Date(now.getTime() - FEED_GRACE_MS).toISOString();

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_closed", false)
    .gt("date_start", cutoff)
    .order("date_start", { ascending: true })
    // Ближайшие идеи; дальше по времени экран всё равно не листают.
    .limit(SEARCH_POSTS_LIMIT);

  const needle = escapeForOr(filters.query);
  if (needle) {
    query = query.or(
      `title.ilike.%${needle}%,description.ilike.%${needle}%,geo_city.ilike.%${needle}%,geo_address.ilike.%${needle}%`,
    );
  }

  if (filters.category_ids.length) query = query.in("category_id", filters.category_ids);
  // Границы дней — по Берлину, а не по UTC: иначе вечер на стыке дней
  // попадал бы не в тот день.
  const from = filters.date_from ? berlinDayStart(filters.date_from) : null;
  if (from) query = query.gte("date_start", from);
  if (filters.date_to) {
    // Конец дня — полночь следующего по Берлину. Полдень UTC как опора не
    // даёт перехода на летнее время сдвинуть дату.
    const next = new Date(new Date(`${filters.date_to}T12:00:00Z`).getTime() + DAY_MS)
      .toISOString()
      .slice(0, 10);
    const end = berlinDayStart(next);
    if (end) query = query.lt("date_start", end);
  }
  if (filters.geo_mode === "city" && filters.geo_city) {
    query = query.ilike("geo_city", filters.geo_city.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(`Поиск не отработал: ${error.message}`);

  let posts = await toPostViews((data ?? []) as unknown as PostRow[]);

  if (filters.time_window) {
    const { from_minutes, to_minutes } = filters.time_window;
    posts = posts.filter((post) => {
      const minutes = minutesOfDay(post.date_start);
      return minutes >= from_minutes && minutes <= to_minutes;
    });
  }

  if (filters.geo_mode === "radius" && filters.geo_radius_m) {
    const radius = filters.geo_radius_m;
    posts = posts.filter((post) => {
      if (!origin || post.geo_lat == null || post.geo_lng == null) return false;
      return distanceMetres(origin, { lat: post.geo_lat, lng: post.geo_lng }) <= radius;
    });
  }

  return posts;
}

/** Сколько людей отдаёт один запрос поиска (0036 ограничивает и сам). */
export const PEOPLE_RESULTS_LIMIT = 30;

/**
 * Люди по нику, факультету, интересам или вузу. Ищет база (search_people,
 * 0036) с правами зрителя — в браузер уходят только совпадения, а не все
 * профили сразу.
 */
export async function searchUsers(query: string): Promise<UserView[]> {
  const needle = query.trim();
  if (needle.length < 2) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .rpc("search_people", { q: needle, max_results: PEOPLE_RESULTS_LIMIT })
    .select("*,university:universities(*)");

  type UserWithUniversity = Tables<"users"> & { university: Tables<"universities"> | null };
  return toUserViews((data ?? []) as unknown as UserWithUniversity[]);
}
