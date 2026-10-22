"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { describedBy, Field, TextInput } from "@/components/ui/field";
import { initialFormState, type FormState } from "@/lib/auth/form-state";
import { emailProblem, normalizeEmail } from "@/lib/auth/validation";
import { FormError, FormNotice } from "./form-message";
import { useFormErrors } from "./use-form-errors";

const ORDER = ["email"] as const;

/** Почта для письма со ссылкой восстановления. */
export function ForgotForm({ notice }: { notice?: string | null }) {
  const [state, submit, pending] = useActionState(
    requestPasswordReset,
    initialFormState as FormState<"email">,
  );
  const { errorOf, clear, check, guard, alertRef } = useFormErrors(state, ORDER);
  const error = errorOf("email");

  return (
    <form
      action={submit}
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        const problem = emailProblem(normalizeEmail(new FormData(event.currentTarget).get("email")));
        guard(event, problem ? { email: problem } : {});
      }}
    >
      {notice && state.status === "idle" ? <FormNotice>{notice}</FormNotice> : null}

      <Field label="Почта" htmlFor="email" required error={error}>
        <TextInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy("email", { error })}
          onChange={() => clear("email")}
          onBlur={(event) => {
            const value = normalizeEmail(event.currentTarget.value);
            if (value) check(event, "email", emailProblem(value));
          }}
        />
      </Field>

      {state.formError ? (
        <FormError id="forgot-error" ref={alertRef}>
          {state.formError}
        </FormError>
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
