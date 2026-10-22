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
 * Открыты всем: /auth/* (иначе на страницу входа нельзя было бы попасть),
 * /legal/* (Impressum и Datenschutzerklärung по закону доступны без входа)
 * и /api/health (мониторинг). В режиме моков защита выключена — локальная разработка идёт от
 * имени mara_t без входа.
 *
 * Это первый рубеж, а не единственный: каждая запись и чтение идут в базу с
 * JWT пользователя, и права решает RLS (docs/ARCHITECTURE.md).
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSessionTokenCookie } from "@/lib/auth/session-cookies";
import { contentSecurityPolicy, createNonce } from "@/lib/csp";
import { isPublicPath } from "@/lib/public-paths";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/** Экраны, которые вошедшему незачем видеть. */
const SIGNED_OUT_ONLY = new Set(["/auth/login", "/auth/signup"]);

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
      cookieOptions: sessionCookieOptions,
    },
  );

  // Редирект — новый ответ. Обновлённые или стёртые cookie сессии надо
  // перенести и в него, иначе браузер останется со старыми и каждый
  // следующий запрос снова пойдёт продлевать уже отозванную сессию.
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  // getUser() проверяет токен на сервере Supabase (и что сессия не
  // отозвана); getSession() поверил бы cookie на слово.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/auth/login";
    login.search = "";
    login.searchParams.set("next", pathname + request.nextUrl.search);
    // Cookie сессии были, а входа нет: срок вышел или сессию отозвали.
    if (request.cookies.getAll().some(({ name }) => isSessionTokenCookie(name))) {
      login.searchParams.set("expired", "1");
    }
    return redirectTo(login);
  }

  // Вошедшему незачем видеть форму входа. Кроме случая, когда на неё
  // отправило само приложение с ошибкой (lib/data/session.ts): вернуть
  // такого человека на главную значило бы зациклить редиректы.
  if (user && SIGNED_OUT_ONLY.has(pathname) && !request.nextUrl.searchParams.has("error")) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return redirectTo(home);
  }

  return response;
}

export const config = {
  // Всё, кроме статики Next, иконок, манифеста, robots и вебхуков: вебхук
  // приходит от Stripe без сессии, его защищает подпись, а не вход
  // (app/api/webhooks).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|opengraph-image|api/webhooks).*)",
  ],
};
