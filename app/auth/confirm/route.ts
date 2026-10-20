/**
 * Ссылка из письма в виде `token_hash` — работает на любом устройстве.
 *
 * В отличие от PKCE (app/auth/callback), здесь не нужен cookie того
 * браузера, где письмо запросили: человек просит сброс на ноутбуке и
 * открывает письмо на телефоне. Чтобы письма вели сюда, шаблон в Supabase
 * должен указывать `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`
 * (локально — supabase/templates, на проде — docs/SECURITY.md).
 */

import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, recoveryCookieOptions, RESET_PATH } from "@/lib/recovery";
import { siteUrl } from "@/lib/site-url";

const ACCEPTED: readonly EmailOtpType[] = ["recovery", "signup", "email"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = await siteUrl();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const recovery = type === "recovery";

  if (tokenHash && type && ACCEPTED.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user) {
      if (recovery) {
        (await cookies()).set(
          RECOVERY_COOKIE,
          data.user.id,
          recoveryCookieOptions(origin.startsWith("https:")),
        );
        return NextResponse.redirect(`${origin}${RESET_PATH}`);
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(
    recovery ? `${origin}/auth/forgot?error=link` : `${origin}/auth/login?error=link`,
  );
}
