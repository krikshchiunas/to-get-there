/**
 * Ссылка из письма в виде `token_hash` — работает на любом устройстве.
 *
 * В отличие от PKCE (app/auth/callback), здесь не нужен cookie того
 * браузера, где письмо запросили: человек просит сброс на ноутбуке и
 * открывает письмо на телефоне. Чтобы письма вели сюда, шаблоны в Supabase
 * должны указывать `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`
 * (на проде — docs/AUTH.md, «Шаблоны писем»).
 *
 * Что пришло в адресе, решает только, какой вид токена спросить у
 * Supabase. Пустит ли он — решает verifyOtp, а метку восстановления
 * ставим, лишь если Supabase сам недавно отправлял письмо сброса.
 */

import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
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

function otpTypeOf(raw: string | null): EmailOtpType {
  if (raw === "recovery") return "recovery";
  if (raw === "signup") return "signup";
  return "email";
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = otpTypeOf(params.get("type"));
  const next = safeNext(params.get("next"));
  const tokenHash = params.get("token_hash") ?? "";

  if (tokenHash) {
    const auth = await createAuthGateway();
    const { data, error } = await auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error && data.user) {
      const store = await cookies();
      store.delete({ name: PENDING_EMAIL_COOKIE, path: "/auth" });
      if (type === "recovery" && recoveryRequestedRecently(data.user.recovery_sent_at)) {
        store.set(
          RECOVERY_COOKIE,
          data.user.id,
          recoveryCookieOptions(process.env.NODE_ENV === "production"),
        );
        return relativeRedirect(RESET_PATH);
      }
      return relativeRedirect(next);
    }
    if (error)
      await reportAuthFailure(
        type === "recovery" ? "recovery_link" : "confirm_email",
        "/auth/confirm",
        error,
      );
  }

  // Уже использованная ссылка подтверждения — не ошибка для того, кто внутри.
  if (type !== "recovery") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email_confirmed_at) return relativeRedirect(next);
  }

  return relativeRedirect(type === "recovery" ? "/auth/forgot?error=link" : "/auth/login?error=link");
}
