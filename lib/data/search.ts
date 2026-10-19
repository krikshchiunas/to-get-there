/**
 * Поиск.
 *
 * Текст и категории отбирает база, а окно времени суток и радиус считаются
 * в коде: первое требует арифметики по часовому поясу, второе — расстояния.
 * Честный вариант для радиуса — postgis или earthdistance, он отложен
 * (docs/ROADMAP.md, «что сознательно отложено»).
 */

import { createClient } from "@/lib/supabase/server";
import { distanceMetres, FEED_GRACE_MS, minutesOfDay } from "@/lib/format";
import type { PostView, SearchFilters, UserView } from "@/lib/types";
import { POST_SELECT, toPostViews, type PostRow } from "./feed";
import { toUserViews } from "./people";
import { requireViewerId } from "./session";
import type { Tables } from "@/lib/database.types";

/** Где стоит зритель — для фильтра «радиус вокруг меня». */
export const viewerLocation = { lat: 52.5106, lng: 13.3274, label: "TU Berlin, Charlottenburg" };

/** PostgREST-фильтр `or` ломается на запятых и скобках внутри значения. */
function escapeForOr(value: string): string {
  return value.replace(/[,().*]/g, " ").trim();
}

export async function searchPosts(filters: SearchFilters, now: Date): Promise<PostView[]> {
  const supabase = await createClient();
  const cutoff = new Date(now.getTime() - FEED_GRACE_MS).toISOString();

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_closed", false)
    .gt("date_start", cutoff)
    .order("date_start", { ascending: true });

  const needle = escapeForOr(filters.query);
  if (needle) {
    query = query.or(
      `title.ilike.%${needle}%,description.ilike.%${needle}%,geo_city.ilike.%${needle}%,geo_address.ilike.%${needle}%`,
    );
  }

  if (filters.category_ids.length) query = query.in("category_id", filters.category_ids);
  if (filters.date_from) query = query.gte("date_start", `${filters.date_from}T00:00:00`);
  if (filters.date_to) query = query.lte("date_start", `${filters.date_to}T23:59:59`);
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
      if (post.geo_lat == null || post.geo_lng == null) return false;
      return distanceMetres(viewerLocation, { lat: post.geo_lat, lng: post.geo_lng }) <= radius;
    });
  }

  return posts;
}

/** Все, кого видно в поиске. Клиентский экран фильтрует этот список у себя. */
export async function getSearchableUsers(): Promise<UserView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("*,university:universities(*)")
    .eq("privacy_settings->>visible_in_search", "true")
    .order("nickname");

  type UserWithUniversity = Tables<"users"> & { university: Tables<"universities"> | null };
  return toUserViews((data ?? []) as unknown as UserWithUniversity[]);
}

export async function searchUsers(query: string): Promise<UserView[]> {
  const needle = escapeForOr(query);
  if (!needle) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("*,university:universities(*)")
    .eq("privacy_settings->>visible_in_search", "true")
    .neq("id", await requireViewerId())
    .or(`nickname.ilike.%${needle}%,faculty.ilike.%${needle}%`)
    .order("nickname");

  type UserWithUniversity = Tables<"users"> & { university: Tables<"universities"> | null };
  return toUserViews((data ?? []) as unknown as UserWithUniversity[]);
}
