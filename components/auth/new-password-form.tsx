"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { updatePassword, type PasswordState } from "@/app/auth/actions";
import { checkNewPassword, MIN_PASSWORD, type CredentialField } from "@/lib/auth/credentials";
import { PasswordInput } from "./password-input";

const ERROR_ID = "password-error";

/** Новый пароль дважды. После успеха действие ведёт на /auth/reset/done. */
export function NewPasswordForm() {
  const [state, submit, pending] = useActionState<PasswordState, FormData>(updatePassword, {
    error: null,
    field: null,
  });
  const [local, setLocal] = useState<{ error: string; field: CredentialField | null } | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const shown = local ?? (state.error ? { error: state.error, field: state.field } : null);

  function focusProblem(field: CredentialField | null) {
    const target = field === "repeat" ? repeatRef.current : field === "password" ? passwordRef.current : null;
    (target ?? errorRef.current)?.focus();
  }

  useEffect(() => {
    if (state.error) focusProblem(state.field);
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const problem = checkNewPassword(String(data.get("password") ?? ""), String(data.get("repeat") ?? ""));
    if (problem) {
      event.preventDefault();
      setLocal({ error: problem.message, field: problem.field });
      focusProblem(problem.field);
      return;
    }
    setLocal(null);
  }

  function errorProps(field: CredentialField) {
    const mine = shown !== null && shown.field === field;
    return {
      "aria-invalid": mine ? true : undefined,
      "aria-describedby": mine ? ERROR_ID : undefined,
    } as const;
  }

  return (
    <form action={submit} onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field label="Новый пароль" htmlFor="password" required hint={`Не короче ${MIN_PASSWORD} символов.`}>
        <PasswordInput
          ref={passwordRef}
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          {...errorProps("password")}
        />
      </Field>

      <Field label="Ещё раз" htmlFor="repeat" required>
        <PasswordInput
          ref={repeatRef}
          id="repeat"
          name="repeat"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          {...errorProps("repeat")}
        />
      </Field>

      {shown ? (
        <p
          ref={errorRef}
          id={ERROR_ID}
          role="alert"
          tabIndex={-1}
          className="text-[14px] leading-[1.4] text-heat outline-none"
        >
          {shown.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" full disabled={pending} aria-busy={pending || undefined}>
        {pending ? "Сохраняем…" : "Сохранить пароль"}
      </Button>
    </form>
  );
}
