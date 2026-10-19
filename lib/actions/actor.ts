/**
 * Общее для серверных действий: кто действует и как говорить об ошибках.
 *
 * Права проверяет не этот код, а RLS в базе: любое действие идёт через
 * клиент с сессией пользователя, и политики из 0008 решают, можно ли.
 * Здесь — только то, что нужно, чтобы ответить человеку понятно.
 */

import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function getActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Своя строка users видна по RLS — то же сопоставление, что делает
  // private.current_user_id() в политиках (auth_user_id = auth.uid()).
  const { data: me } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!me) return null;

  return { supabase, viewerId: me.id, authUserId: user.id };
}

export const notSignedIn: ActionResult = {
  ok: false,
  error: "Сессия закончилась. Войди снова.",
};

/** Коды Postgres и PostgREST — на русский и словами пользователя. */
export function explainDbError(error: { code?: string; message?: string } | null): string {
  if (!error) return "Не получилось. Попробуй ещё раз.";
  switch (error.code) {
    case "42501": // RLS отказал
      return "На это нет прав.";
    case "23505":
      return "Это уже сделано.";
    case "23514":
      return "Данные не прошли проверку. Проверь поля и попробуй снова.";
    case "23503":
      return "То, к чему это относится, уже удалено.";
    case "PGRST116":
      return "Не нашлось — возможно, это уже удалили.";
  }
  return "Не получилось. Попробуй ещё раз.";
}

export function fail(error: { code?: string; message?: string } | null): ActionResult {
  return { ok: false, error: explainDbError(error) };
}
