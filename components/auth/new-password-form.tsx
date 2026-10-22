"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { initialFormState, type FormState } from "@/lib/auth/form-state";
import {
  PASSWORD_HINT,
  passwordProblem,
  validateNewPassword,
  type NewPasswordField,
} from "@/lib/auth/validation";
import { FormError } from "./form-message";
import { PasswordInput } from "./password-input";
import { useFormErrors } from "./use-form-errors";

const ORDER: readonly NewPasswordField[] = ["password", "repeat"];

/**
 * Новый пароль дважды. После успеха действие ведёт на /auth/reset/done.
 *
 * Скрытое поле с почтой — для менеджеров паролей: по нему они понимают, у
 * какой записи обновить пароль (так советуют Chrome и Apple для форм
 * сброса). Атрибут hidden (display:none), а не type=hidden: поля type=hidden
 * менеджеры не читают.
 */
export function NewPasswordForm({ email }: { email: string | null }) {
  const [state, submit, pending] = useActionState(
    updatePassword,
    initialFormState as FormState<NewPasswordField>,
  );
  const { errorOf, clear, check, guard, alertRef } = useFormErrors(state, ORDER);
  const errors = { password: errorOf("password"), repeat: errorOf("repeat") };

  return (
    <form
      action={submit}
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        guard(
          event,
          validateNewPassword(String(data.get("password") ?? ""), String(data.get("repeat") ?? "")),
        );
      }}
    >
      {email ? (
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      ) : null}

      <Field label="Новый пароль" htmlFor="password" required hint={PASSWORD_HINT} error={errors.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={describedBy("password", { hint: true, error: errors.password })}
          onChange={() => clear("password")}
          onBlur={(event) => {
            const value = event.currentTarget.value;
            if (value) check(event, "password", passwordProblem(value));
          }}
        />
      </Field>

      <Field label="Ещё раз" htmlFor="repeat" required error={errors.repeat}>
        <PasswordInput
          id="repeat"
          name="repeat"
          autoComplete="new-password"
          required
          aria-invalid={errors.repeat ? true : undefined}
          aria-describedby={describedBy("repeat", { error: errors.repeat })}
          onChange={() => clear("repeat")}
        />
      </Field>

      {state.formError ? (
        <FormError id="password-error" ref={alertRef}>
          {state.formError}
        </FormError>
      ) : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить пароль"}
      </Button>
    </form>
  );
}
