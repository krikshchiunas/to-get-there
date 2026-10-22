/**
 * Клиент только для Supabase Auth: вход, регистрация, письма, ссылки.
 *
 * Зачем отдельный от lib/supabase/server.ts. Auth ограничивает частоту по IP,
 * а эти запросы идут с нашего сервера — для Auth все пользователи на одном
 * адресе, и один перебор паролей исчерпал бы лимит входа для всех. Supabase
 * решает это заголовком Sb-Forwarded-For с IP человека; принимает его только
 * с секретным ключом (sb_secret_…) и только когда пересылка включена в
 * панели (docs/AUTH.md, «Лимиты»).
 *
 * Секретный ключ обходит RLS, поэтому наружу отсюда выходят только шесть
 * методов Auth — ни `.from()`, ни `.auth.admin`. Данные всегда читает и
 * пишет клиент с сессией пользователя (server.ts). Без SUPABASE_AUTH_IP_FORWARDING
 * всё работает с публичным ключом, как раньше.
 *
 * Только для server actions и route handlers: им можно писать cookie.
 */

import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createStatelessClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { clientIpFrom } from "@/lib/auth/client-ip";
import { classifyAuthError, type AuthFailure } from "@/lib/auth/errors";
import { sessionCookieOptions } from "./cookie-options";

type Auth = SupabaseClient<Database>["auth"];

export interface AuthGateway {
  signInWithPassword: Auth["signInWithPassword"];
  signUp: Auth["signUp"];
  resetPasswordForEmail: Auth["resetPasswordForEmail"];
  resend: Auth["resend"];
  verifyOtp: Auth["verifyOtp"];
  exchangeCodeForSession: Auth["exchangeCodeForSession"];
}

interface Connection {
  url: string;
  key: string;
  headers: Record<string, string>;
}

async function connection(): Promise<Connection> {
  if (typeof window !== "undefined") throw new Error("lib/supabase/auth: только на сервере");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) {
    throw new Error("Нет NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local.example).");
  }

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (process.env.SUPABASE_AUTH_IP_FORWARDING === "true" && secret?.startsWith("sb_secret_")) {
    const ip = clientIpFrom(await headers());
    if (ip) return { url, key: secret, headers: { "Sb-Forwarded-For": ip } };
  }
  return { url, key: publicKey, headers: {} };
}

/** Auth с cookie запроса: успешный вход или переход по ссылке кладёт сессию в cookie. */
export async function createAuthGateway(): Promise<AuthGateway> {
  const { url, key, headers: extra } = await connection();
  const store = await cookies();

  const { auth } = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        // Без try/catch, в отличие от server.ts: этот клиент зовут только
        // там, где писать cookie можно, и молча потерянная сессия была бы
        // ошибкой, которую не найти.
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
    cookieOptions: sessionCookieOptions,
    global: { headers: extra },
  });

  return {
    signInWithPassword: (credentials) => auth.signInWithPassword(credentials),
    signUp: (credentials) => auth.signUp(credentials),
    resetPasswordForEmail: (email, options) => auth.resetPasswordForEmail(email, options),
    resend: (credentials) => auth.resend(credentials),
    verifyOtp: (params) => auth.verifyOtp(params),
    exchangeCodeForSession: (code) => auth.exchangeCodeForSession(code),
  };
}

/**
 * Пароль верный? Для действий, которые требуют подтвердить личность
 * изнутри уже открытой сессии: смена пароля, удаление аккаунта.
 *
 * Supabase Auth не умеет «проверить пароль» отдельно (current_password в
 * updateUser работает, только если включён флагом на сервере), поэтому
 * это вход отдельным клиентом без cookie. Сессию, которую он создал, сразу
 * отзываем: проверка не должна оставлять за собой входов.
 */
export async function verifyPassword(email: string, password: string): Promise<"ok" | AuthFailure> {
  const { url, key, headers: extra } = await connection();
  const probe = createStatelessClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: extra },
  });

  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return classifyAuthError(error);

  await probe.auth.signOut({ scope: "local" });
  return "ok";
}
