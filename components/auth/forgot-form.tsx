"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { requestPasswordReset, type AuthState } from "@/app/auth/actions";

/** Почта для письма со ссылкой восстановления. */
export function ForgotForm({ notice }: { notice?: string | null }) {
  const [state, submit, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {
    error: null,
    email: "",
  });

  return (
    <form action={submit} className="space-y-5" noValidate>
      {notice && !state.error ? (
        <p
          role="status"
          className="rounded-field bg-sunken px-4 py-3 text-[14px] leading-[1.4] text-ink-soft"
        >
          {notice}
        </p>
      ) : null}

      <Field label="Почта" htmlFor="email" required>
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
          aria-describedby={state.error ? "forgot-error" : undefined}
        />
      </Field>

      {state.error ? (
        <p id="forgot-error" role="alert" className="text-[14px] leading-[1.4] text-heat">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Отправляем…" : "Прислать ссылку"}
      </Button>

      <p className="text-center text-[14px] text-ink-soft">
        Вспомнил пароль?{" "}
        <Link href="/auth/login" className="text-signal underline underline-offset-2">
          Войти
        </Link>
      </p>
    </form>
  );
}
