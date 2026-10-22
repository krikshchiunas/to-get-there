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
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { AccountInfo } from "@/lib/types";
import { reportAuthEvent, reportAuthFailure } from "@/lib/auth/report";
import { createClient } from "@/lib/supabase/server";

/** mara_t — тот же, кого lib/mock/users.ts зовёт `currentUser`. */
export const DEV_VIEWER_ID = "33333333-3333-3333-3333-000000000001";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/**
 * users.id для аккаунта из сессии.
 *
 * Профиль создаёт триггер регистрации в той же транзакции, что и аккаунт
 * (0013, 0043), а удалить его в обход аккаунта нельзя — так что «аккаунт без
 * профиля» почти невозможен. Если он всё же случился (аккаунт старше моста,
 * ручная правка базы), профиль восстанавливается по тем же правилам, что при
 * регистрации, вместо того чтобы экран упал.
 */
export async function profileIdOf(
  supabase: SupabaseClient<Database>,
  authUserId: string,
): Promise<string | null> {
  const { data } = await supabase.from("users").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (data) return data.id;

  const { data: repaired, error } = await supabase.rpc("ensure_my_profile");
  if (error || !repaired) {
    await reportAuthFailure("profile_repair", "session", "server");
    return null;
  }
  await reportAuthEvent("profile_repair", "session");
  return repaired;
}

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

  return profileIdOf(supabase, user.id);
});

/** Почта и даты аккаунта — для «Вход и безопасность». Из Auth, не из профиля. */
export async function loadAccount(): Promise<AccountInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/auth/login?error=session");
  return {
    email: user.email,
    created_at: user.created_at,
    email_confirmed_at: user.email_confirmed_at ?? null,
  };
}

/**
 * Зритель для запросов, которым без него нечего показывать. Middleware уже
 * не пускает на такие экраны без входа; редирект здесь — страховка на случай,
 * если сессия истекла между проверкой и запросом. `error=session` не даёт
 * middleware вернуть вошедшего обратно сюда же — иначе петля.
 */
export async function requireViewerId(): Promise<string> {
  const id = await getViewerId();
  if (!id) redirect("/auth/login?error=session");
  return id;
}
