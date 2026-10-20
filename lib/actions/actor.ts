/**
 * Общее для серверных действий: кто действует и как говорить об ошибках.
 *
 * Права проверяет не этот код, а RLS в базе: любое действие идёт через
 * клиент с сессией пользователя, и политики из 0008 решают, можно ли.
 * Здесь — только то, что нужно, чтобы ответить человеку понятно.
 */

import { createClient } from "@/lib/supabase/server";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function getActor() {
  // Моки — витрина без базы: записывать некуда (см. noActor).
  if (usingMocks) return null;

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

/** Почему действовать некому: в демо-режиме — не сессия виновата. */
export function noActor(): ActionResult {
  return usingMocks ? { ok: false, error: "Это демо без базы: изменения не сохраняются." } : notSignedIn;
}

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
    case "P0429": // ограничение частоты, 0031
      return "Слишком часто. Подожди минуту и попробуй снова.";
  }
  return "Не получилось. Попробуй ещё раз.";
}

export function fail(error: { code?: string; message?: string } | null): ActionResult {
  return { ok: false, error: explainDbError(error) };
}
