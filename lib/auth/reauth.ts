/**
 * Подтвердить личность паролем изнутри уже открытой сессии — перед сменой
 * пароля и удалением аккаунта.
 *
 * Обычный серверный модуль, а не "use server": всё, что экспортирует файл с
 * "use server", становится конечной точкой, которую браузер может вызвать
 * напрямую, а отдельная «проверка пароля» наружу не нужна.
 */

import { verifyPassword } from "@/lib/supabase/auth";
import type { createClient } from "@/lib/supabase/server";
import type { AuthFailure } from "./errors";
import { reportAuthFailure } from "./report";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Не больше пяти попыток за 15 минут на аккаунт (0043): иначе украденная
 * сессия могла бы подбирать пароль через эти формы.
 */
export async function confirmIdentity(
  supabase: ServerClient,
  email: string,
  password: string,
  route: string,
): Promise<"ok" | AuthFailure> {
  if (!password) return "invalid_credentials";

  const { error: limit } = await supabase.rpc("claim_reauth_attempt");
  if (limit) {
    if (limit.code === "P0429") return reportAuthFailure("reauthenticate", route, "rate_limited");
    return reportAuthFailure("reauthenticate", route, limit.code === "42501" ? "session_missing" : "server");
  }

  const verdict = await verifyPassword(email, password);
  if (verdict !== "ok") await reportAuthFailure("reauthenticate", route, verdict);
  return verdict;
}
