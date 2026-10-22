/**
 * Кто вошёл — auth.users.id из проверенного токена сессии.
 *
 * Каждый экран и каждое действие спрашивают это заново. getUser() — это
 * запрос к серверу Supabase Auth; getClaims() проверяет подпись токена
 * здесь же, ключом из /.well-known/jwks.json (проект подписывает токены
 * ES256, ключ кешируется на 10 минут). Разница — один сетевой запрос на
 * каждый экран.
 *
 * Чего подпись не знает — отозвана ли сессия: токен после выхода
 * математически всё ещё верен до истечения (не больше часа). Это
 * проверяет middleware: getUser() идёт к серверу Supabase Auth на каждом
 * запросе, который вообще доходит до экранов и действий, и выход
 * (app/auth/actions.ts) отрезает украденные cookies уже там. Здесь — та же
 * сессия того же запроса, только без второго похода за тем же ответом.
 *
 * Если подпись проверить нечем (симметричный ключ, нет WebCrypto),
 * getClaims() сам вызывает getUser(). Если упал запрос за ключом — тоже
 * спрашиваем сервер, а не считаем человека вышедшим.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function verifiedAuthUserId(supabase: SupabaseClient<Database>): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    // Нет сессии, подпись не сошлась, токен истёк — не вошёл.
    if (error || !data) return null;
    return typeof data.claims.sub === "string" && data.claims.sub !== "" ? data.claims.sub : null;
  } catch {
    // Не ошибка входа, а сбой по дороге (например, сеть до jwks.json).
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
