"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { updatePassword, type PasswordState } from "@/app/auth/actions";
import { MIN_PASSWORD } from "@/lib/recovery";

/** Новый пароль дважды. После успеха действие ведёт на /auth/reset/done. */
export function NewPasswordForm() {
  const [state, submit, pending] = useActionState<PasswordState, FormData>(updatePassword, { error: null });

  const describedBy = state.error ? "password-error" : undefined;

  return (
    <form action={submit} className="space-y-5" noValidate>
      <Field label="Новый пароль" htmlFor="password" required hint={`Не короче ${MIN_PASSWORD} символов.`}>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={describedBy}
        />
      </Field>

      <Field label="Ещё раз" htmlFor="repeat" required>
        <TextInput
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={describedBy}
        />
      </Field>

      {state.error ? (
        <p id="password-error" role="alert" className="text-[14px] leading-[1.4] text-heat">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить пароль"}
      </Button>
    </form>
  );
}
