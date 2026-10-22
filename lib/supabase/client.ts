/**
 * Supabase client for the browser.
 *
 * Used from client components only — anything that renders on the server
 * takes `createClient()` from `lib/supabase/server.ts` instead, so the
 * session cookie is read per request.
 *
 * The client is untyped on purpose: `lib/database.types.ts` does not exist
 * yet. Generate it once the schema is applied —
 *
 *   npm run db:types     # supabase gen types typescript --local
 *
 * — and then pass the generic through here and in server.ts:
 *
 *   import type { Database } from "@/lib/database.types";
 *   createBrowserClient<Database>(url, anonKey)
 *
 * Until then the row types in `lib/types.ts` are the contract, and they
 * mirror the schema column for column.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { sessionCookieOptions } from "./cookie-options";

// Read as static members: Next.js only inlines NEXT_PUBLIC_* when the
// property is accessed literally, never through a computed key.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * A browser client bound to the current session cookie.
 *
 * `createBrowserClient` keeps one instance per page, so calling this in
 * several components is cheap and they all share the same auth state and the
 * same realtime socket.
 */
export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Нет переменных Supabase: задай NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local (образец — .env.local.example).",
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, { cookieOptions: sessionCookieOptions });
}
