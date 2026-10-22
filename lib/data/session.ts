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
import { verifiedAuthUserId } from "@/lib/auth/identity";
import { profileIdFor } from "@/lib/auth/profile";

/** mara_t — тот же, кого lib/mock/users.ts зовёт `currentUser`. */
export const DEV_VIEWER_ID = "33333333-3333-3333-3333-000000000001";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/**
 * Идентификатор зрителя в public.users или null без входа.
 *
 * Вход проверяется по подписи токена (lib/auth/identity.ts), а не
 * `getSession()`, который доверяет cookie на слово. Отозвана ли сессия,
 * на этом же запросе уже спросил у Supabase Auth middleware.
 *
 * Вход есть, а профиль не нашёлся и не восстановился (lib/auth/profile.ts) —
 * это сбой, а не «не вошёл»: ошибка, а не редирект на вход. Иначе
 * middleware вернул бы вошедшего с /auth/login обратно, и так по кругу.
 */
export const getViewerId = cache(async (): Promise<string | null> => {
  if (usingMocks) return DEV_VIEWER_ID;

  const supabase = await createClient();
  const authUserId = await verifiedAuthUserId(supabase);
  if (!authUserId) return null;

  const id = await profileIdFor(supabase, authUserId);
  if (!id) throw new Error("Профиль аккаунта не найден и не восстановился.");
  return id;
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
