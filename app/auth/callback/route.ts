/**
 * Возврат из письма: подтверждение почты или восстановление пароля.
 *
 * Supabase приводит сюда с одноразовым `code` (PKCE). Обмениваем его на
 * сессию — после этого человек вошёл, и его профиль уже создан триггером
 * регистрации из миграции 0013. Для восстановления (`type=recovery`) ставим
 * метку из lib/recovery.ts и ведём на форму нового пароля.
 *
 * PKCE требует того же браузера, где письмо запросили. Ссылка, открытая на
 * другом устройстве, идёт через app/auth/confirm — см. docs/SECURITY.md.
 */

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  RECOVERY_COOKIE,
  recoveryCookieOptions,
  recoveryRequestedRecently,
  RESET_PATH,
} from "@/lib/recovery";
import { relativeRedirect } from "@/lib/relative-redirect";
import { classifyAuthError } from "@/lib/auth/errors";
import { logAuthEvent } from "@/lib/auth/log";
import { requestIdOf } from "@/lib/auth/request";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const recovery = searchParams.get("type") === "recovery";

  const requestId = requestIdOf(request.headers);
  const log = (outcome: "ok" | "failure", category?: ReturnType<typeof classifyAuthError>) =>
    logAuthEvent({ op: "email_link", outcome, category, route: "/auth/callback", requestId });

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    log(error ? "failure" : "ok", error ? classifyAuthError(error) : undefined);
    if (!error) {
      // `type=recovery` — из адреса; метку ставим, только если Supabase сам
      // недавно отправлял этому аккаунту письмо сброса.
      if (recovery && data.user && recoveryRequestedRecently(data.user.recovery_sent_at)) {
        (await cookies()).set(
          RECOVERY_COOKIE,
          data.user.id,
          recoveryCookieOptions(process.env.NODE_ENV === "production"),
        );
        return relativeRedirect(RESET_PATH);
      }
      return relativeRedirect("/");
    }
  }

  if (!code) log("failure", "link_invalid");
  // Ссылка устарела или уже использована — объясняем там, где её можно запросить снова.
  return relativeRedirect(recovery ? "/auth/forgot?error=link" : "/auth/login?error=link");
}
