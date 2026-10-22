/**
 * Ссылка из письма в виде `token_hash` — работает на любом устройстве.
 *
 * В отличие от PKCE (app/auth/callback), здесь не нужен cookie того
 * браузера, где письмо запросили: человек просит сброс на ноутбуке и
 * открывает письмо на телефоне. Чтобы письма вели сюда, шаблон в Supabase
 * должен указывать `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`
 * (на проде — docs/SECURITY.md, «Сделать руками»).
 *
 * Что пришло в адресе, решает только, какой вид токена спросить у
 * Supabase. Пустит ли он — решает verifyOtp, а метку восстановления
 * ставим, лишь если Supabase сам недавно отправлял письмо сброса.
 */

import type { EmailOtpType } from "@supabase/supabase-js";
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

function otpTypeOf(raw: string | null): EmailOtpType {
  if (raw === "recovery") return "recovery";
  if (raw === "signup") return "signup";
  return "email";
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = otpTypeOf(params.get("type"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: params.get("token_hash") ?? "" });

  if (error || !data.user) {
    return relativeRedirect(type === "recovery" ? "/auth/forgot?error=link" : "/auth/login?error=link");
  }

  if (type === "recovery" && recoveryRequestedRecently(data.user.recovery_sent_at)) {
    (await cookies()).set(
      RECOVERY_COOKIE,
      data.user.id,
      recoveryCookieOptions(process.env.NODE_ENV === "production"),
    );
    return relativeRedirect(RESET_PATH);
  }
  return relativeRedirect("/");
}
