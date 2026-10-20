/** Справочники: университеты и категории. Меняются редко, читаются везде. */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Category, University } from "@/lib/types";
import { toCategory, toUniversity } from "./map";

export const loadCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("is_main", { ascending: false })
    .order("name");
  return (data ?? []).map(toCategory);
});

export const loadUniversities = cache(async (): Promise<University[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("universities").select("*").order("name");
  return (data ?? []).map(toUniversity);
});

export async function getCategory(id: string): Promise<Category | undefined> {
  return (await loadCategories()).find((c) => c.id === id);
}

export async function getUniversity(id: string): Promise<University | undefined> {
  return (await loadUniversities()).find((u) => u.id === id);
}

/** Города, где прямо сейчас есть идеи — для подсказок в фильтре. */
export async function getCitiesWithPosts(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("active_posts").select("geo_city");
  const cities = new Set((data ?? []).flatMap((row) => (row.geo_city ? [row.geo_city] : [])));
  return [...cities].sort((a, b) => a.localeCompare(b, "ru"));
}
