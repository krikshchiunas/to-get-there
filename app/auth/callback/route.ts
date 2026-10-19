/**
 * Возврат из письма подтверждения.
 *
 * Supabase приводит сюда с одноразовым `code` (PKCE). Обмениваем его на
 * сессию — после этого человек вошёл, и его профиль уже создан триггером
 * регистрации из миграции 0013.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  // Ссылка устарела или уже использована — объясняем на экране входа.
  return NextResponse.redirect(`${origin}/auth/login?error=link`);
}
