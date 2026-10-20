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
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, recoveryCookieOptions, RESET_PATH } from "@/lib/recovery";
import { siteUrl } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Не request.nextUrl.origin: за прокси и в `next start` это адрес самого
  // сервера (localhost), а не тот, что в адресной строке, — и cookie сессии
  // остались бы на другом хосте.
  const origin = await siteUrl();
  const code = searchParams.get("code");
  const recovery = searchParams.get("type") === "recovery";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (recovery && data.user) {
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

  // Ссылка устарела или уже использована — объясняем там, где её можно запросить снова.
  return NextResponse.redirect(
    recovery ? `${origin}/auth/forgot?error=link` : `${origin}/auth/login?error=link`,
  );
}
