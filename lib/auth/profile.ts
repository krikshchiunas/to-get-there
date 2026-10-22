/**
 * Профиль вошедшего: строка public.users по auth.users.id.
 *
 * Безопасная идентичность — auth.uid() из проверенного Supabase токена;
 * профиль находится по уникальному users.auth_user_id, и ровно так же его
 * находят политики RLS (private.current_user_id()). Клиент id профиля не
 * присылает и выбрать его не может.
 *
 * Если профиля нет (строку когда-то удалили, или аккаунт старше моста
 * регистрации), он создаётся здесь же — public.ensure_my_profile() (0043),
 * той же функцией, что и триггер регистрации. Повторный вызов безопасен.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logAuthEvent } from "./log";

export async function profileIdFor(
  supabase: SupabaseClient<Database>,
  authUserId: string,
): Promise<string | null> {
  const { data } = await supabase.from("users").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (data) return data.id;

  const repaired = await supabase.rpc("ensure_my_profile");
  const ok = !repaired.error && typeof repaired.data === "string";
  logAuthEvent({
    op: "profile_repair",
    outcome: ok ? "ok" : "failure",
    category: ok ? undefined : "unknown",
    route: "server",
    requestId: crypto.randomUUID(),
  });
  return ok ? (repaired.data as string) : null;
}
