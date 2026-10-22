"use server";

/**
 * Вход, регистрация, письма, пароль и выход.
 *
 * Серверные действия, а не клиентские вызовы: пароль не проходит через
 * JavaScript браузера дальше формы, сессия сразу ложится в cookie, а
 * проверку полей нельзя обойти — форма проверяет то же самое только ради
 * подсказок (lib/auth/validation.ts).
 *
 * Чего ответы не выдают: есть ли аккаунт с этой почтой. Регистрация на
 * занятый адрес, сброс пароля и повторное письмо отвечают так же, как на
 * свободный (docs/AUTH.md, «Перечисление аккаунтов»).
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_MESSAGES, type AuthFailure } from "@/lib/auth/errors";
import { fieldFailure, formFailure, formSuccess, type FormState } from "@/lib/auth/form-state";
import { PENDING_EMAIL_COOKIE, pendingEmailCookieOptions, readPendingEmail } from "@/lib/auth/pending-email";
import { reportAuthEvent, reportAuthFailure } from "@/lib/auth/report";
import { isSessionCookie } from "@/lib/auth/session-cookies";
import {
  hasErrors,
  normalizeEmail,
  readPassword,
  validateLogin,
  validateNewPassword,
  validatePasswordChange,
  validateSignup,
  emailProblem,
  type ChangePasswordField,
  type LoginField,
  type NewPasswordField,
  type SignupField,
} from "@/lib/auth/validation";
import { LEGAL_REVISION } from "@/lib/legal";
import { RECOVERY_COOKIE, recoveryMatches, RESET_DONE_PATH } from "@/lib/recovery";
import { safeNext } from "@/lib/safe-next";
import { siteUrl } from "@/lib/site-url";
import { confirmIdentity } from "@/lib/auth/reauth";
import { createAuthGateway } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const secureCookies = process.env.NODE_ENV === "production";

async function rememberPendingEmail(email: string): Promise<void> {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, pendingEmailCookieOptions(secureCookies));
}

/** Куда вести из письма: наш адрес (не Host запроса) и, если есть, экран, ради которого входили. */
async function callbackUrl(next: string, type?: "recovery"): Promise<string> {
  const url = new URL("/auth/callback", await siteUrl());
  if (type) url.searchParams.set("type", type);
  if (next !== "/") url.searchParams.set("next", next);
  return url.toString();
}

/* ── вход ──────────────────────────────────────────────────────────── */

export async function signIn(_: FormState<LoginField>, form: FormData): Promise<FormState<LoginField>> {
  const email = normalizeEmail(form.get("email"));
  const password = readPassword(form.get("password"));
  const next = safeNext(form.get("next"));

  const problems = validateLogin({ email, password });
  if (hasErrors(problems)) return fieldFailure(email, problems);

  const auth = await createAuthGateway();
  const { error } = await auth.signInWithPassword({ email, password });
  if (error) {
    const kind = await reportAuthFailure("sign_in", "/auth/login", error);
    if (kind === "email_not_confirmed") {
      // Пароль верный — человек доказал, что аккаунт его; можно предложить письмо.
      await rememberPendingEmail(email);
      return formFailure(email, AUTH_MESSAGES.email_not_confirmed, { unconfirmed: true });
    }
    return formFailure(email, signInMessage(kind));
  }

  redirect(next);
}

function signInMessage(kind: AuthFailure): string {
  switch (kind) {
    case "invalid_credentials":
    case "rate_limited":
      return AUTH_MESSAGES[kind];
    case "invalid_email":
      return AUTH_MESSAGES.invalid_credentials;
    default:
      return AUTH_MESSAGES.server;
  }
}

/* ── регистрация ───────────────────────────────────────────────────── */

export async function signUp(_: FormState<SignupField>, form: FormData): Promise<FormState<SignupField>> {
  const email = normalizeEmail(form.get("email"));
  const password = readPassword(form.get("password"));
  const repeat = readPassword(form.get("repeat"));
  const terms = form.get("terms") === "on";
  const next = safeNext(form.get("next"));

  const problems = validateSignup({ email, password, repeat, terms });
  if (hasErrors(problems)) return fieldFailure(email, problems);

  // Подсказка до похода в Auth: на отказ триггера он отвечает общей ошибкой
  // базы. Отказывает всё равно база (0043), поэтому при сбое проверки —
  // идём дальше, а не закрываем регистрацию.
  const supabase = await createClient();
  const { data: allowed, error: eligibilityError } = await supabase.rpc("signup_allowed", { email });
  if (eligibilityError) await reportAuthFailure("sign_up", "/auth/signup", "server");
  else if (allowed === false) {
    return fieldFailure(email, {
      email: "Сейчас аккаунт можно создать только с почтой университета из списка — например, @tu-berlin.de.",
    });
  }

  const auth = await createAuthGateway();
  const { data, error } = await auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await callbackUrl(next),
      // Какую редакцию условий человек принял. Сам флажок проверен выше.
      data: { terms_revision: LEGAL_REVISION, terms_accepted_at: new Date().toISOString() },
    },
  });

  if (error) {
    const kind = await reportAuthFailure("sign_up", "/auth/signup", error);
    switch (kind) {
      // Занятый адрес и «письмо уже ушло» — тот же ответ, что и свободному
      // адресу: «проверь почту». Иначе форма выдавала бы, кто здесь есть.
      case "user_exists":
      case "email_frequency":
        break;
      case "weak_password":
      case "leaked_password":
        return fieldFailure(email, { password: AUTH_MESSAGES[kind] });
      case "invalid_email":
        return fieldFailure(email, { email: AUTH_MESSAGES.invalid_email });
      case "rate_limited":
      case "email_quota":
      case "email_send_failed":
      case "signup_disabled":
        return formFailure(email, AUTH_MESSAGES[kind]);
      default:
        return formFailure(email, AUTH_MESSAGES.server);
    }
  }

  // Подтверждение почты выключено (бывает локально) — сессия уже есть.
  if (data?.session) redirect(next);

  await rememberPendingEmail(email);
  redirect("/auth/check-email");
}

/* ── письмо подтверждения ещё раз ──────────────────────────────────── */

export async function resendConfirmation(_: FormState<"email">, form: FormData): Promise<FormState<"email">> {
  const store = await cookies();
  const typed = normalizeEmail(form.get("email"));
  const email = typed || readPendingEmail(store.get(PENDING_EMAIL_COOKIE)?.value) || "";

  const problem = emailProblem(email);
  if (problem) return fieldFailure(typed, { email: problem });

  const auth = await createAuthGateway();
  const { error } = await auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: await callbackUrl(safeNext(form.get("next"))) },
  });

  if (error) {
    const kind = await reportAuthFailure("resend_confirmation", "/auth/check-email", error);
    // Лимит на адрес и «аккаунта нет» выглядят одинаково — как успех.
    if (kind === "rate_limited" || kind === "email_quota") return formFailure(typed, AUTH_MESSAGES[kind]);
    if (kind !== "email_frequency" && kind !== "user_exists") return formFailure(typed, AUTH_MESSAGES.server);
  }

  if (typed) await rememberPendingEmail(typed);
  return formSuccess(
    "Если этот адрес ждёт подтверждения, новое письмо уже в пути. Ссылка из прежнего письма больше не действует.",
    typed,
  );
}

/* ── «Забыли пароль?» ──────────────────────────────────────────────── */

export async function requestPasswordReset(
  _: FormState<"email">,
  form: FormData,
): Promise<FormState<"email">> {
  const email = normalizeEmail(form.get("email"));
  const problem = emailProblem(email);
  if (problem) return fieldFailure(email, { email: problem });

  const auth = await createAuthGateway();
  const { error } = await auth.resetPasswordForEmail(email, {
    redirectTo: await callbackUrl("/", "recovery"),
  });

  if (error) {
    const kind = await reportAuthFailure("recovery_request", "/auth/forgot", error);
    // Об отказе говорим, только если он не зависит от того, есть ли аккаунт:
    // лимит запросов с этого IP и общий лимит писем. «Письмо этому адресу
    // уже уходило» и сбой отправки бывают только у существующего аккаунта.
    if (kind === "rate_limited" || kind === "email_quota") return formFailure(email, AUTH_MESSAGES[kind]);
  }

  await rememberPendingEmail(email);
  redirect("/auth/check-email?reason=reset");
}

/* ── новый пароль по ссылке из письма ──────────────────────────────── */

export async function updatePassword(
  _: FormState<NewPasswordField>,
  form: FormData,
): Promise<FormState<NewPasswordField>> {
  const password = readPassword(form.get("password"));
  const repeat = readPassword(form.get("repeat"));

  const problems = validateNewPassword(password, repeat);
  if (hasErrors(problems)) return fieldFailure("", problems);

  const store = await cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!recoveryMatches(store.get(RECOVERY_COOKIE)?.value, user?.id)) {
    return formFailure("", "Ссылка устарела. Запроси новое письмо — это займёт минуту.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const kind = await reportAuthFailure("password_update", "/auth/reset", error);
    if (kind === "same_password" || kind === "weak_password" || kind === "leaked_password") {
      return fieldFailure("", { password: AUTH_MESSAGES[kind] });
    }
    return formFailure("", kind === "session_missing" ? AUTH_MESSAGES.link_invalid : AUTH_MESSAGES.server);
  }

  // Supabase Auth при смене пароля отзывает все остальные сессии, а 0043
  // делает это мгновенным и для базы.
  store.delete({ name: RECOVERY_COOKIE, path: "/auth" });
  store.delete({ name: PENDING_EMAIL_COOKIE, path: "/auth" });
  redirect(RESET_DONE_PATH);
}

/* ── смена пароля изнутри ──────────────────────────────────────────── */

export async function changePassword(
  _: FormState<ChangePasswordField>,
  form: FormData,
): Promise<FormState<ChangePasswordField>> {
  const current = readPassword(form.get("current"));
  const password = readPassword(form.get("password"));
  const repeat = readPassword(form.get("repeat"));

  const problems = validatePasswordChange({ current, password, repeat });
  if (hasErrors(problems)) return fieldFailure("", problems);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return formFailure("", AUTH_MESSAGES.session_missing);

  const verdict = await confirmIdentity(supabase, user.email, current, "/settings/security");
  if (verdict !== "ok") {
    return verdict === "invalid_credentials"
      ? fieldFailure("", { current: "Текущий пароль не подходит." })
      : formFailure("", AUTH_MESSAGES[verdict]);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const kind = await reportAuthFailure("password_change", "/settings/security", error);
    if (kind === "same_password" || kind === "weak_password" || kind === "leaked_password") {
      return fieldFailure("", { password: AUTH_MESSAGES[kind] });
    }
    return formFailure("", kind === "session_missing" ? AUTH_MESSAGES.session_missing : AUTH_MESSAGES.server);
  }

  return formSuccess("Пароль изменён. На других устройствах нужно будет войти заново.");
}

/* ── выход ─────────────────────────────────────────────────────────── */

/** Выход на этом устройстве. Остальные устройства остаются в аккаунте. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    await reportAuthFailure("sign_out", "/settings", error);
    // Auth не ответил — supabase-js оставил бы сессию в cookie. Выход на
    // этом устройстве обязан сработать всё равно.
    const store = await cookies();
    for (const { name } of store.getAll()) if (isSessionCookie(name)) store.delete(name);
  }
  redirect("/auth/login?signed_out=1");
}

/**
 * Выход на всех устройствах: Auth отзывает все сессии аккаунта, а база
 * перестаёт признавать их токены сразу (0043), не дожидаясь их срока.
 */
export async function signOutEverywhere(): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    await reportAuthFailure("sign_out", "/settings/security", error);
    // Здесь нельзя делать вид, что получилось: другие устройства остались бы внутри.
    return formFailure("", "Не получилось выйти на всех устройствах. Попробуй ещё раз.");
  }
  await reportAuthEvent("sign_out", "/settings/security");
  redirect("/auth/login?signed_out=all");
}
