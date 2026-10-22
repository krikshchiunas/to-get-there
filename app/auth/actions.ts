"use server";

/**
 * Вход, регистрация, письма и выход.
 *
 * Серверные действия, а не клиентские вызовы: пароль не проходит через
 * JavaScript браузера дальше формы, а сессия сразу ложится в cookie
 * (lib/supabase/cookies.ts). Правила полей — lib/auth/credentials.ts,
 * слова ошибок — lib/auth/errors.ts, лимиты — lib/auth/rate-limit.ts,
 * журнал — lib/auth/log.ts. Сообщения Supabase наружу не уходят.
 *
 * Ни одно действие не говорит, есть ли аккаунт с такой почтой: регистрация
 * на занятый адрес и сброс пароля для несуществующего отвечают так же, как
 * для настоящих.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  checkEmail,
  checkNewPassword,
  checkSignIn,
  checkSignUp,
  normalizeEmail,
  type CredentialField,
} from "@/lib/auth/credentials";
import {
  authMessage,
  classifyAuthError,
  retryMessage,
  revealsAccount,
  type AuthFailure,
} from "@/lib/auth/errors";
import { logAuthEvent, type AuthOperation } from "@/lib/auth/log";
import { PENDING_EMAIL_COOKIE, pendingEmailCookieOptions } from "@/lib/auth/pending-email";
import { checkAuthRateLimit, type LimitedOperation } from "@/lib/auth/rate-limit";
import { clientAddress, requestIdOf } from "@/lib/auth/request";
import { RECOVERY_COOKIE, recoveryMatches, RESET_DONE_PATH } from "@/lib/recovery";
import { safeNext } from "@/lib/safe-next";
import { siteUrl } from "@/lib/site-url";

export interface AuthState {
  error: string | null;
  /** Поле, на которое перевести фокус; null — ошибка формы целиком. */
  field: CredentialField | null;
  /** Что ввёл человек — чтобы при ошибке не набирать почту заново. */
  email: string;
  /** Почта не подтверждена — экран предложит отправить письмо ещё раз. */
  unconfirmed?: boolean;
  /** Повторное письмо отправлено (форма на «Проверь почту»). */
  sent?: boolean;
}

export interface PasswordState {
  error: string | null;
  field: CredentialField | null;
}

const secureCookies = process.env.NODE_ENV === "production";

async function requestContext(route: string) {
  const h = await headers();
  return { address: clientAddress(h), requestId: requestIdOf(h), route };
}

type Context = Awaited<ReturnType<typeof requestContext>>;

function log(
  ctx: Context,
  op: AuthOperation,
  outcome: "ok" | "failure" | "rate_limited",
  category?: AuthFailure,
) {
  logAuthEvent({ op, outcome, category, route: ctx.route, requestId: ctx.requestId });
}

/** Лимит попыток: null — можно, иначе — текст для экрана. */
async function limited(
  ctx: Context,
  op: LimitedOperation,
  logOp: AuthOperation,
  email: string | null,
): Promise<string | null> {
  const result = await checkAuthRateLimit(op, { address: ctx.address, email });
  if (result.allowed) return null;
  log(ctx, logOp, "rate_limited", "rate_limited");
  return retryMessage(result.retryAfterSeconds);
}

async function rememberPendingEmail(email: string) {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, pendingEmailCookieOptions(secureCookies));
}

/** К какому полю относится отказ Supabase — туда и фокус. */
function fieldOf(failure: AuthFailure): CredentialField | null {
  switch (failure) {
    case "invalid_email":
      return "email";
    case "invalid_credentials":
    case "weak_password":
    case "same_password":
      return "password";
    default:
      return null;
  }
}

/* ── вход ──────────────────────────────────────────────────────────── */

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") ?? "");

  const problem = checkSignIn(email, password);
  if (problem) return { error: problem.message, field: problem.field, email };

  const ctx = await requestContext("/auth/login");
  const tooMany = await limited(ctx, "sign_in", "sign_in", email);
  if (tooMany) return { error: tooMany, field: null, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const failure = classifyAuthError(error);
    log(ctx, "sign_in", "failure", failure);
    if (failure === "email_not_confirmed") {
      await rememberPendingEmail(email);
      return { error: authMessage(failure), field: null, email, unconfirmed: true };
    }
    // Сбой сервиса — «что-то пошло не так», а не «неверный пароль»: иначе
    // человек начнёт подбирать пароль, который у него правильный.
    return { error: authMessage(failure), field: fieldOf(failure), email };
  }

  log(ctx, "sign_in", "ok");
  // `next` пришёл из адресной строки — только путь внутри приложения.
  redirect(safeNext(form.get("next")));
}

/* ── регистрация ───────────────────────────────────────────────────── */

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") ?? "");
  const repeat = String(form.get("repeat") ?? "");

  const problem = checkSignUp(email, password, repeat);
  if (problem) return { error: problem.message, field: problem.field, email };

  const ctx = await requestContext("/auth/signup");
  const tooMany = await limited(ctx, "sign_up", "sign_up", null);
  if (tooMany) return { error: tooMany, field: null, email };

  // Куда вести после клика в письме — адрес из настроек (lib/site-url.ts).
  const origin = await siteUrl();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    const failure = classifyAuthError(error);
    log(ctx, "sign_up", "failure", failure);
    // Занятый адрес и «письмо уже отправлено» не выдаём: ответ — как при
    // успехе. Если письма и правда нет, на «Проверь почту» есть «ещё раз».
    if (!revealsAccount(failure)) {
      return { error: authMessage(failure), field: fieldOf(failure), email };
    }
  } else {
    log(ctx, "sign_up", "ok");
    // Подтверждение почты выключено — сессия уже есть, можно сразу внутрь.
    if (data.session) redirect("/");
  }

  await rememberPendingEmail(email);
  redirect("/auth/check-email");
}

/* ── письма ────────────────────────────────────────────────────────── */

/**
 * «Забыли пароль?» — письмо со ссылкой восстановления. Ответ одинаковый,
 * есть аккаунт с такой почтой или нет; сказать можно только про частоту
 * нашего лимита — она одинакова для любого адреса.
 */
export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = normalizeEmail(form.get("email"));
  const problem = checkEmail(email);
  if (problem) return { error: problem.message, field: problem.field, email };

  const ctx = await requestContext("/auth/forgot");
  const tooMany = await limited(ctx, "password_reset", "password_reset_request", email);
  if (tooMany) return { error: tooMany, field: null, email };

  const origin = await siteUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?type=recovery`,
  });
  if (error) {
    const failure = classifyAuthError(error);
    log(ctx, "password_reset_request", "failure", failure);
    if (!revealsAccount(failure)) return { error: authMessage(failure), field: null, email };
  } else {
    log(ctx, "password_reset_request", "ok");
  }

  await rememberPendingEmail(email);
  redirect("/auth/check-email?reason=reset");
}

/**
 * Письмо подтверждения ещё раз. Ответ одинаковый для любого адреса: GoTrue
 * отправит письмо, только если аккаунт ждёт подтверждения.
 */
export async function resendConfirmation(_: AuthState, form: FormData): Promise<AuthState> {
  const email = normalizeEmail(form.get("email"));
  const problem = checkEmail(email);
  if (problem) return { error: problem.message, field: problem.field, email };

  const ctx = await requestContext("/auth/check-email");
  const tooMany = await limited(ctx, "resend_confirmation", "resend_confirmation", email);
  if (tooMany) return { error: tooMany, field: null, email };

  const origin = await siteUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    const failure = classifyAuthError(error);
    log(ctx, "resend_confirmation", "failure", failure);
    if (!revealsAccount(failure)) return { error: authMessage(failure), field: null, email };
  } else {
    log(ctx, "resend_confirmation", "ok");
  }

  await rememberPendingEmail(email);
  return { error: null, field: null, email, sent: true };
}

/* ── новый пароль ──────────────────────────────────────────────────── */

/**
 * Новый пароль — только по свежей ссылке из письма (lib/recovery.ts).
 * После смены остальные сессии аккаунта отзываются: если пароль меняют
 * потому, что его украли, вор не должен остаться внутри.
 */
export async function updatePassword(_: PasswordState, form: FormData): Promise<PasswordState> {
  const password = String(form.get("password") ?? "");
  const repeat = String(form.get("repeat") ?? "");

  const problem = checkNewPassword(password, repeat);
  if (problem) return { error: problem.message, field: problem.field };

  const ctx = await requestContext("/auth/reset");
  const store = await cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!recoveryMatches(store.get(RECOVERY_COOKIE)?.value, user?.id)) {
    log(ctx, "password_update", "failure", "link_invalid");
    return { error: authMessage("link_invalid"), field: null };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const failure = classifyAuthError(error);
    log(ctx, "password_update", "failure", failure);
    return { error: authMessage(failure), field: fieldOf(failure) };
  }

  await supabase.auth.signOut({ scope: "others" });
  store.delete({ name: RECOVERY_COOKIE, path: "/auth" });
  log(ctx, "password_update", "ok");
  redirect(RESET_DONE_PATH);
}

/* ── выход ─────────────────────────────────────────────────────────── */

/**
 * Выход с этого устройства: сессия отзывается в Supabase (refresh-токен
 * больше не обменять), cookie стираются. Остальные устройства остаются
 * внутри — как в любом приложении; после сброса пароля — см. выше.
 */
export async function signOut(): Promise<void> {
  const ctx = await requestContext("/settings");
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  const store = await cookies();
  store.delete({ name: RECOVERY_COOKIE, path: "/auth" });
  if (error) {
    // Supabase не ответил — сессию на этом устройстве всё равно забываем:
    // cookie сессии (sb-…-auth-token и её части) стираются здесь.
    for (const cookie of store.getAll()) {
      if (/^sb-.+-auth-token(\.\d+)?$/.test(cookie.name)) store.delete(cookie.name);
    }
  }
  log(ctx, "sign_out", error ? "failure" : "ok", error ? classifyAuthError(error) : undefined);
  redirect("/auth/login?signed_out=1");
}
