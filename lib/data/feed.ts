/**
 * Лента из базы.
 *
 * Правило ленты живёт в трёх местах и они обязаны совпадать: `isInFeed` в
 * lib/format.ts, представление `public.active_posts` и условие ниже. Здесь
 * оно выражено через `posts`, а не через `active_posts`, потому что нужны
 * вложенные автор, университет и категория целыми объектами — ровно та
 * форма, которую ждёт `PostView`.
 */

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { FEED_GRACE_MS } from "@/lib/format";
import type { FeedTab, PostView } from "@/lib/types";
import { loadFollowCounts, loadViewer, loadViewerEdges, loadViewerMemberships } from "./social";
import { noSocialFacts, roleIn, toCategory, toUniversity, toUserView } from "./map";

// Одной строкой: PostgREST получает значение select как есть, а переносы
// строк в нём ломают разбор.
export const POST_SELECT =
  "*,author:users!posts_author_id_fkey(*,university:universities(*))," +
  "university:universities!posts_university_id_fkey(*)," +
  "category:categories(*),participants:post_participants(count)";

/**
 * Форма строки, которую возвращает POST_SELECT.
 *
 * Выведение типов у supabase-js на вложенных select со склейкой строк не
 * работает — оно схлопывается в `never`. Поэтому форма описана явно, а
 * приведение стоит ровно в одном месте, на границе запроса.
 */
export type PostRow = Tables<"posts"> & {
  author: (Tables<"users"> & { university: Tables<"universities"> | null }) | null;
  university: Tables<"universities"> | null;
  category: Tables<"categories"> | null;
  participants: { count: number }[] | null;
};

/** `post_participants(count)` приходит как [{ count: n }]. */
function participantCountOf(row: PostRow): number {
  const first = row.participants?.[0];
  return typeof first?.count === "number" ? first.count : 0;
}

export async function toPostViews(rows: PostRow[]): Promise<PostView[]> {
  if (rows.length === 0) return [];

  const [edges, memberships, counts] = await Promise.all([
    loadViewerEdges(),
    loadViewerMemberships(),
    loadFollowCounts(rows.map((row) => row.author_id)),
  ]);

  return rows.flatMap((row) => {
    if (!row.author || !row.category) return [];

    return [
      {
        id: row.id,
        author_id: row.author_id,
        title: row.title,
        description: row.description,
        category_id: row.category_id,
        date_start: row.date_start,
        geo_lat: row.geo_lat,
        geo_lng: row.geo_lng,
        geo_city: row.geo_city,
        geo_address: row.geo_address,
        geo_mode: row.geo_mode,
        geo_radius_m: row.geo_radius_m as PostView["geo_radius_m"],
        max_participants: row.max_participants,
        is_closed: row.is_closed,
        chat_access: row.chat_access,
        university_id: row.university_id,
        created_at: row.created_at,
        author: toUserView(row.author, counts.get(row.author_id) ?? noSocialFacts),
        university: row.university ? toUniversity(row.university) : null,
        category: toCategory(row.category),
        participant_count: participantCountOf(row),
        viewer_role: roleIn(
          row.id,
          row.author_id,
          edges.viewerId,
          memberships.participantPosts,
          memberships.moderatorPosts,
        ),
      },
    ];
  });
}

/** Идей на страницу ленты и предел, после которого «Показать ещё» ведёт в поиск. */
export const FEED_PAGE = 50;
export const FEED_MAX = 500;

export async function getFeed(tab: FeedTab, now: Date, limit: number): Promise<PostView[]> {
  const supabase = await createClient();

  // Идея уходит из ленты через час после начала; то же условие, что в
  // isInFeed и в active_posts.
  const cutoff = new Date(now.getTime() - FEED_GRACE_MS).toISOString();

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("is_closed", false)
    .gt("date_start", cutoff)
    // При равном времени — по id: страницы не теряют и не повторяют идеи.
    .order("date_start", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);

  if (tab === "following") {
    const edges = await loadViewerEdges();
    const authors = [...edges.viewerFollows].filter((id) => id !== edges.viewerId);
    if (authors.length === 0) return [];
    query = query.in("author_id", authors);
  } else {
    // Своя лента вуза; у кого вуза нет (0043) — все идеи («Все»).
    const viewer = await loadViewer();
    if (viewer.university_id) query = query.eq("university_id", viewer.university_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Лента не загрузилась: ${error.message}`);

  return toPostViews((data ?? []) as unknown as PostRow[]);
}
