"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { checkEmail, normalizeEmail } from "@/lib/auth/credentials";
import type { AuthState } from "@/app/auth/actions";

type Action = (state: AuthState, form: FormData) => Promise<AuthState>;

/**
 * Форма из одного поля почты: «Забыли пароль?» и «Отправить письмо ещё
 * раз». Ответ на любую почту одинаковый — какой именно, решает действие.
 */
export function EmailForm({
  id,
  action,
  initialEmail = "",
  submitLabel,
  pendingLabel,
  sentText,
  notice,
  footer,
}: {
  /** Префикс id полей: на одной странице форм может быть две. */
  id: string;
  action: Action;
  initialEmail?: string;
  submitLabel: string;
  pendingLabel: string;
  /** Что сказать, когда действие вернуло `sent`. */
  sentText?: string;
  notice?: string | null;
  footer?: ReactNode;
}) {
  const [state, submit, pending] = useActionState(action, { error: null, field: null, email: initialEmail });
  const [local, setLocal] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const error = local ?? state.error;
  const errorId = `${id}-error`;
  const inputId = `${id}-email`;

  useEffect(() => {
    if (state.error) inputRef.current?.focus();
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const problem = checkEmail(normalizeEmail(new FormData(event.currentTarget).get("email")));
    if (problem) {
      event.preventDefault();
      setLocal(problem.message);
      inputRef.current?.focus();
      return;
    }
    setLocal(null);
  }

  return (
    <form action={submit} onSubmit={handleSubmit} className="space-y-5" noValidate>
      {notice && !error ? (
        <p
          role="status"
          className="rounded-field bg-sunken px-4 py-3 text-[14px] leading-[1.4] text-ink-soft"
        >
          {notice}
        </p>
      ) : null}

      <Field label="Почта" htmlFor={inputId} required>
        <TextInput
          ref={inputRef}
          id={inputId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email}
          placeholder="имя@почта.de"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </Field>

      {error ? (
        <p id={errorId} role="alert" className="text-[14px] leading-[1.4] text-heat">
          {error}
        </p>
      ) : state.sent && sentText ? (
        <p role="status" className="text-[14px] leading-[1.4] text-ink-soft">
          {sentText}
        </p>
      ) : null}

      <Button type="submit" size="lg" full disabled={pending} aria-busy={pending || undefined}>
        {pending ? pendingLabel : submitLabel}
      </Button>

      {footer}
    </form>
  );
}
