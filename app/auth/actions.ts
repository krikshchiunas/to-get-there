"use server";

/**
 * Вход, регистрация и выход.
 *
 * Серверные действия, а не клиентские вызовы: пароль не проходит через
 * JavaScript браузера дальше формы, а сессия сразу ложится в httpOnly-cookie.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { siteUrl } from "@/lib/site-url";

export interface AuthState {
  error: string | null;
  /** Что ввёл человек — чтобы при ошибке не набирать почту заново. */
  email: string;
}

const MIN_PASSWORD = 8;

function readEmail(form: FormData): string {
  return String(form.get("email") ?? "").trim().toLowerCase();
}


/** Сообщения Supabase — на русский и словами пользователя. */
function explain(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Неверная почта или пароль.";
  if (m.includes("email not confirmed")) {
    return "Почта ещё не подтверждена. Открой письмо от To Get There и перейди по ссылке.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "С этой почтой уже есть аккаунт. Войди или восстанови пароль.";
  }
  // Триггер регистрации отказывает чужому домену, а Supabase отдаёт это
  // наружу как общую ошибку базы. Подменяем на то, что произошло на деле.
  if (m.includes("database error saving new user")) {
    return "Этот адрес не относится ни к одному университету из списка. Используй университетскую почту.";
  }
  // Supabase сам проверяет, что на адрес можно доставить письмо, и
  // отклоняет недоставляемые домены раньше нашего триггера.
  if (m.includes("is invalid") || m.includes("email_address_invalid")) {
    return "Этот адрес почты не принимается. Проверь, что он написан без ошибок.";
  }
  if (m.includes("error sending") || m.includes("sending confirmation")) {
    return "Не удалось отправить письмо подтверждения. Попробуй через несколько минут.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Слишком много попыток. Подожди минуту и попробуй снова.";
  }
  if (m.includes("password")) return `Пароль должен быть не короче ${MIN_PASSWORD} символов.`;
  return "Не получилось. Проверь данные и попробуй ещё раз.";
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = readEmail(form);
  const password = String(form.get("password") ?? "");

  if (!email || !password) return { error: "Введи почту и пароль.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: explain(error.message), email };

  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = readEmail(form);
  const password = String(form.get("password") ?? "");

  if (!email.includes("@")) return { error: "Введи адрес почты целиком.", email };
  if (password.length < MIN_PASSWORD) {
    return { error: `Пароль должен быть не короче ${MIN_PASSWORD} символов.`, email };
  }

  // Куда вести после клика в письме — адрес из настроек (lib/site-url.ts).
  const origin = await siteUrl();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: explain(error.message), email };

  // Подтверждение почты выключено — сессия уже есть, можно сразу внутрь.
  if (data.session) redirect("/");

  redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
