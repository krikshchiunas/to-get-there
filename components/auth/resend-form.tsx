"use client";

import { useActionState, useEffect, useState } from "react";
import { resendConfirmation } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { describedBy, Field, TextInput } from "@/components/ui/field";
import { initialFormState, type FormState } from "@/lib/auth/form-state";
import { emailProblem, normalizeEmail } from "@/lib/auth/validation";
import { FormError, FormNotice } from "./form-message";
import { useFormErrors } from "./use-form-errors";

const ORDER = ["email"] as const;

/** Supabase Auth отправляет одному адресу не чаще раза в минуту. */
const COOLDOWN_SECONDS = 60;

/**
 * «Отправить письмо ещё раз». Почту, на которую ушло письмо, знает сервер
 * (httpOnly-cookie, lib/auth/pending-email.ts); если не знает — например,
 * ссылку открыли на другом устройстве, — человек вводит её сам.
 *
 * Ответ одинаковый, есть такой аккаунт или нет. Минута ожидания между
 * письмами — честная подсказка формы, а не защита: защищает лимит Auth.
 */
export function ResendForm({ knownEmail }: { knownEmail: boolean }) {
  const [state, submit, pending] = useActionState(resendConfirmation, initialFormState as FormState<"email">);
  const { errorOf, clear, guard, alertRef } = useFormErrors(state, ORDER);
  const [wait, setWait] = useState(0);
  const error = errorOf("email");

  useEffect(() => {
    if (state.status === "success") setWait(COOLDOWN_SECONDS);
  }, [state]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  return (
    <form
      action={submit}
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        if (knownEmail) return guard(event, {});
        const problem = emailProblem(normalizeEmail(new FormData(event.currentTarget).get("email")));
        guard(event, problem ? { email: problem } : {});
      }}
    >
      {knownEmail ? null : (
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
          />
        </Field>
      )}

      {state.notice ? <FormNotice>{state.notice}</FormNotice> : null}
      {state.formError ? (
        <FormError id="resend-error" ref={alertRef}>
          {state.formError}
        </FormError>
      ) : null}

      <Button type="submit" variant="quiet" size="lg" full disabled={pending || wait > 0}>
        {pending
          ? "Отправляем…"
          : wait > 0
            ? `Отправить ещё раз можно через ${wait} с`
            : "Отправить письмо ещё раз"}
      </Button>
    </form>
  );
}
