/**
 * Сессия и доступ.
 *
 * Делает две вещи на каждом запросе:
 *   1. обновляет токен Supabase в cookies — без этого серверные компоненты
 *      видели бы просроченную сессию;
 *   2. не пускает на экраны приложения без входа.
 *
 * Экраны /auth/* открыты всем: иначе на страницу входа нельзя было бы
 * попасть. В режиме моков защита выключена — локальная разработка идёт от
 * имени mara_t без входа.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export async function middleware(request: NextRequest) {
  if (usingMocks) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() проверяет токен на сервере Supabase; getSession() поверил бы
  // cookie на слово.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const login = request.nextUrl.clone();
    login.pathname = "/auth/login";
    login.search = "";
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // Вошедшему незачем видеть форму входа.
  if (user && (request.nextUrl.pathname === "/auth/login" || request.nextUrl.pathname === "/auth/signup")) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // Всё, кроме статики Next, иконки и вебхуков: вебхук приходит от Stripe
  // без сессии, его защищает подпись, а не вход (app/api/webhooks).
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|api/webhooks).*)"],
};
