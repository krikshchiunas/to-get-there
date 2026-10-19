/**
 * Сессия и доступ.
 *
 * Делает три вещи на каждом запросе:
 *   1. ставит Content-Security-Policy со свежим nonce (lib/csp.ts) — Next
 *      читает его из заголовка запроса и проставляет своим скриптам;
 *   2. обновляет токен Supabase в cookies — без этого серверные компоненты
 *      видели бы просроченную сессию;
 *   3. не пускает на экраны приложения без входа.
 *
 * Экраны /auth/* открыты всем: иначе на страницу входа нельзя было бы
 * попасть. В режиме моков защита выключена — локальная разработка идёт от
 * имени mara_t без входа.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, createNonce } from "@/lib/csp";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV !== "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL,
    mocks: usingMocks,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const pass = () => {
    const next = NextResponse.next({ request: { headers: requestHeaders } });
    next.headers.set("Content-Security-Policy", csp);
    return next;
  };

  if (usingMocks) return pass();

  let response = pass();

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
          requestHeaders.set("cookie", request.cookies.toString());
          response = pass();
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
