"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import type { AuthState } from "@/app/auth/actions";

type Action = (state: AuthState, form: FormData) => Promise<AuthState>;

/**
 * Одна форма на вход и регистрацию: поля одинаковые, отличаются действие,
 * подпись кнопки и подсказка под паролем.
 */
export function AuthForm({
  mode,
  action,
  next,
  notice,
}: {
  mode: "login" | "signup";
  action: Action;
  /** Куда вернуть после входа — экран, с которого человека увёл middleware. */
  next?: string;
  /** Сообщение сверху, например «ссылка из письма устарела». */
  notice?: string | null;
}) {
  const [state, submit, pending] = useActionState(action, { error: null, email: "" });
  const isSignup = mode === "signup";

  return (
    <form action={submit} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {notice && !state.error ? (
        <p role="status" className="rounded-field bg-sunken px-4 py-3 text-[14px] leading-[1.4] text-ink-soft">
          {notice}
        </p>
      ) : null}

      <Field
        label={isSignup ? "Университетская почта" : "Почта"}
        htmlFor="email"
        required
        hint={isSignup ? "Регистрация открыта для адресов вузов из списка — например, @tu-berlin.de." : undefined}
      >
        <TextInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email}
          placeholder="имя@tu-berlin.de"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "auth-error" : undefined}
        />
      </Field>

      <Field
        label="Пароль"
        htmlFor="password"
        required
        hint={isSignup ? "Не короче 8 символов." : undefined}
      >
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? 8 : undefined}
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "auth-error" : undefined}
        />
      </Field>

      {state.error ? (
        <p id="auth-error" role="alert" className="text-[14px] leading-[1.4] text-heat">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? (isSignup ? "Создаём аккаунт…" : "Входим…") : isSignup ? "Создать аккаунт" : "Войти"}
      </Button>

      <p className="text-center text-[14px] text-ink-soft">
        {isSignup ? "Уже есть аккаунт? " : "Ещё нет аккаунта? "}
        <Link
          href={isSignup ? "/auth/login" : "/auth/signup"}
          className="text-signal underline-offset-2 hover:underline"
        >
          {isSignup ? "Войти" : "Зарегистрироваться"}
        </Link>
      </p>
    </form>
  );
}
