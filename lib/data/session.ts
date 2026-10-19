/**
 * Кто смотрит приложение.
 *
 * В режиме базы зритель — это владелец сессии Supabase, сопоставленный со
 * своей строкой в public.users по auth_user_id. Ровно так же сопоставляет
 * private.current_user_id() во всех политиках RLS, а саму строку отдаёт
 * политика users_select_visible только её владельцу (и тем, кому разрешено) —
 * поэтому здесь и в базе зритель гарантированно один и тот же человек.
 *
 * В режиме моков (`NEXT_PUBLIC_USE_MOCKS` не "false") зритель — mara_t, как
 * на этапах 1–4, чтобы локальная разработка не требовала входа.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** mara_t — тот же, кого lib/mock/users.ts зовёт `currentUser`. */
export const DEV_VIEWER_ID = "33333333-3333-3333-3333-000000000001";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/**
 * Идентификатор зрителя в public.users или null без входа.
 *
 * `getUser()`, а не `getSession()`: первый проверяет токен на сервере
 * Supabase, второй доверяет cookie, которую можно подделать.
 */
export const getViewerId = cache(async (): Promise<string | null> => {
  if (usingMocks) return DEV_VIEWER_ID;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
  return data?.id ?? null;
});

/**
 * Зритель для запросов, которым без него нечего показывать. Middleware уже
 * не пускает на такие экраны без входа; редирект здесь — страховка на случай,
 * если сессия истекла между проверкой и запросом.
 */
export async function requireViewerId(): Promise<string> {
  const id = await getViewerId();
  if (!id) redirect("/auth/login");
  return id;
}
