"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePassword, signOutEverywhere } from "@/app/auth/actions";
import { FormError, FormNotice } from "@/components/auth/form-message";
import { PasswordInput } from "@/components/auth/password-input";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { initialFormState, type FormState } from "@/lib/auth/form-state";
import {
  PASSWORD_HINT,
  passwordProblem,
  validatePasswordChange,
  type ChangePasswordField,
} from "@/lib/auth/validation";

const ORDER: readonly ChangePasswordField[] = ["current", "password", "repeat"];

/**
 * Смена пароля изнутри аккаунта. Текущий пароль обязателен: открытая сессия
 * ещё не доказывает, что за экраном владелец (чужой ноутбук, украденная
 * cookie). Остальные устройства после смены выходят — это делает Supabase
 * Auth, а база перестаёт признавать их токены сразу (0043).
 */
export function ChangePasswordForm({ email, demo }: { email: string; demo: boolean }) {
  const [state, submit, pending] = useActionState(
    changePassword,
    initialFormState as FormState<ChangePasswordField>,
  );
  const { errorOf, clear, check, guard, alertRef } = useFormErrors(state, ORDER);
  const errors = { current: errorOf("current"), password: errorOf("password"), repeat: errorOf("repeat") };

  return (
    <form
      action={submit}
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        guard(
          event,
          validatePasswordChange({
            current: String(data.get("current") ?? ""),
            password: String(data.get("password") ?? ""),
            repeat: String(data.get("repeat") ?? ""),
          }),
        );
      }}
    >
      {/* Для менеджеров паролей: какую запись обновить. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

      <Field label="Текущий пароль" htmlFor="current" required error={errors.current}>
        <PasswordInput
          id="current"
          name="current"
          autoComplete="current-password"
          required
          aria-invalid={errors.current ? true : undefined}
          aria-describedby={describedBy("current", { error: errors.current })}
          onChange={() => clear("current")}
        />
      </Field>

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

      <Field label="Новый пароль ещё раз" htmlFor="repeat" required error={errors.repeat}>
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

      {state.notice ? <FormNotice>{state.notice}</FormNotice> : null}
      {state.formError ? (
        <FormError id="change-password-error" ref={alertRef}>
          {state.formError}
        </FormError>
      ) : null}
      {demo ? <FormNotice>Это демо без базы: пароль здесь не меняется.</FormNotice> : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button type="submit" size="lg" disabled={pending || demo}>
          {pending ? "Сохраняем…" : "Сменить пароль"}
        </Button>
        <Link href="/auth/forgot" className="text-[14px] text-signal underline underline-offset-2">
          Не помню текущий пароль
        </Link>
      </div>
    </form>
  );
}

/** Выйти везде: все сессии аккаунта, включая эту. */
export function SignOutEverywhereForm({ demo }: { demo: boolean }) {
  const [state, submit, pending] = useActionState(signOutEverywhere, initialFormState);

  return (
    <form action={submit} className="space-y-3">
      {state.formError ? <FormError id="sign-out-everywhere-error">{state.formError}</FormError> : null}
      <Button type="submit" variant="danger" size="md" disabled={pending || demo}>
        {pending ? "Выходим…" : "Выйти на всех устройствах"}
      </Button>
    </form>
  );
}
