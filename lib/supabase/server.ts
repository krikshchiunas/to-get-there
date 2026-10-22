/**
 * Supabase client for the server: server components, server actions and
 * route handlers.
 *
 * One client per request, because the session lives in cookies and
 * `cookies()` is request-scoped. Never hold the returned client in a
 * module-level variable — that would hand one visitor's session to the next.
 *
 * Untyped for now, exactly like `lib/supabase/client.ts`: generate
 * `lib/database.types.ts` with `npm run db:types` and then write
 * `createServerClient<Database>(…)` in both files.
 */

import { cookies } from "next/headers";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { sessionCookieOptions } from "./cookie-options";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * A request-scoped client that reads and refreshes the session cookie.
 *
 * Next.js 15: `cookies()` is async, so this is async too and every call site
 * awaits it:
 *
 *   const supabase = await createClient();
 *   const { data } = await supabase.from("post_cards").select("*");
 */
export async function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Нет переменных Supabase: задай NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local (образец — .env.local.example).",
    );
  }

  const store = await cookies();

  // Annotated rather than inlined: `createServerClient` still carries the
  // deprecated { get, set, remove } overload, and naming the type picks the
  // getAll/setAll one instead of leaving the callback parameter untyped.
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return store.getAll();
    },
    setAll(cookiesToSet) {
      try {
        for (const { name, value, options } of cookiesToSet) {
          store.set(name, value, options);
        }
      } catch {
        // A server component may not write cookies. Refreshing the session
        // is the job of middleware; here the read simply uses the token it
        // already has, which is why this is swallowed rather than logged.
      }
    },
  };

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: cookieMethods,
    cookieOptions: sessionCookieOptions,
  });
}
