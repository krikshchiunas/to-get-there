/**
 * Возврат из письма: подтверждение почты или восстановление пароля.
 *
 * Supabase приводит сюда с одноразовым `code` (PKCE). Обмениваем его на
 * сессию — после этого человек вошёл, и его профиль уже создан триггером
 * регистрации (0013, 0043). Для восстановления (`type=recovery`) ставим
 * метку из lib/recovery.ts и ведём на форму нового пароля.
 *
 * PKCE требует того же браузера, где письмо запросили. Почту Supabase
 * подтверждает ещё до этого шага, поэтому подтверждение, открытое на
 * другом устройстве, — не ошибка: почта подтверждена, осталось войти.
 * Сброс пароля на другом устройстве работает через app/auth/confirm.
 */

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { classifyAuthError } from "@/lib/auth/errors";
import { PENDING_EMAIL_COOKIE } from "@/lib/auth/pending-email";
import { reportAuthFailure } from "@/lib/auth/report";
import {
  RECOVERY_COOKIE,
  recoveryCookieOptions,
  recoveryRequestedRecently,
  RESET_PATH,
} from "@/lib/recovery";
import { relativeRedirect } from "@/lib/relative-redirect";
import { safeNext } from "@/lib/safe-next";
import { createAuthGateway } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const recovery = searchParams.get("type") === "recovery";
  const next = safeNext(searchParams.get("next"));
  const store = await cookies();

  if (code) {
    const auth = await createAuthGateway();
    const { data, error } = await auth.exchangeCodeForSession(code);
    if (!error) {
      store.delete({ name: PENDING_EMAIL_COOKIE, path: "/auth" });
      // `type=recovery` — из адреса; метку ставим, только если Supabase сам
      // недавно отправлял этому аккаунту письмо сброса.
      if (recovery && data.user && recoveryRequestedRecently(data.user.recovery_sent_at)) {
        store.set(
          RECOVERY_COOKIE,
          data.user.id,
          recoveryCookieOptions(process.env.NODE_ENV === "production"),
        );
        return relativeRedirect(RESET_PATH);
      }
      return relativeRedirect(next);
    }

    const kind = classifyAuthError(error);
    await reportAuthFailure(recovery ? "recovery_link" : "confirm_email", "/auth/callback", error);
    if (kind === "link_other_browser") {
      return relativeRedirect(recovery ? "/auth/forgot?error=browser" : "/auth/login?confirmed=1");
    }
  }

  // Ссылка устарела или уже использована. Подтверждение, по которому уже
  // перешли в этом браузере, — не ошибка: человек и так внутри.
  if (!recovery) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email_confirmed_at) return relativeRedirect(next);
  }

  return relativeRedirect(recovery ? "/auth/forgot?error=link" : "/auth/login?error=link");
}
