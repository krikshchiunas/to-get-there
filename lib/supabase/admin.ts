/**
 * Клиент с серверным ключом — в обход RLS.
 *
 * Нужен ровно в одном месте: вебхук Stripe приходит без сессии
 * пользователя, а итог проверки записывает apply_verification_result(),
 * у которой право на вызов есть только у service_role (0020).
 *
 * Ключ — только из серверного окружения (SUPABASE_SECRET_KEY или старое
 * имя SUPABASE_SERVICE_ROLE_KEY), без NEXT_PUBLIC_: в браузер он не
 * попадает. Никогда не импортировать из клиентских компонентов.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof window !== "undefined") throw new Error("createAdminClient: только на сервере");
  if (!url || !key) throw new Error("createAdminClient: нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SECRET_KEY");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
