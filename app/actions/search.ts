"use server";

/**
 * Поиск людей. Это чтение, а не запись, но из браузера: экран спрашивает
 * по мере ввода, а данные отдаёт база с правами зрителя (search_people,
 * 0036). Зрителя без сессии middleware сюда не пустит.
 */

import { searchUsers } from "@/lib/data";
import type { UserView } from "@/lib/types";

const MAX_QUERY = 80;

export async function findPeople(query: string): Promise<UserView[]> {
  if (typeof query !== "string") return [];
  const needle = query.trim().slice(0, MAX_QUERY);
  if (needle.length < 2) return [];
  return searchUsers(needle);
}
