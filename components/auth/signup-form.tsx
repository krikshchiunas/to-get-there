"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { describedBy, Field, TextInput } from "@/components/ui/field";
import { initialFormState, type FormState } from "@/lib/auth/form-state";
import {
  emailProblem,
  normalizeEmail,
  PASSWORD_HINT,
  passwordProblem,
  validateSignup,
  type SignupField,
} from "@/lib/auth/validation";
import { MIN_AGE } from "@/lib/legal";
import { FormError } from "./form-message";
import { PasswordInput } from "./password-input";
import { useFormErrors } from "./use-form-errors";

const ORDER: readonly SignupField[] = ["email", "password", "repeat", "terms"];

function readForm(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    email: normalizeEmail(data.get("email")),
    password: String(data.get("password") ?? ""),
    repeat: String(data.get("repeat") ?? ""),
    terms: data.get("terms") === "on",
  };
}

export function SignupForm({ next }: { next?: string }) {
  const [state, submit, pending] = useActionState(signUp, initialFormState as FormState<SignupField>);
  const { errorOf, clear, check, guard, alertRef } = useFormErrors(state, ORDER);
  const errors = {
    email: errorOf("email"),
    password: errorOf("password"),
    repeat: errorOf("repeat"),
    terms: errorOf("terms"),
  };

  return (
    <form
      action={submit}
      noValidate
      className="space-y-5"
      onSubmit={(event) => guard(event, validateSignup(readForm(event.currentTarget)))}
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Почта" htmlFor="email" required error={errors.email}>
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
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy("email", { error: errors.email })}
          onChange={() => clear("email")}
          onBlur={(event) => {
            const value = normalizeEmail(event.currentTarget.value);
            if (value) check(event, "email", emailProblem(value));
          }}
        />
      </Field>

      <Field label="Пароль" htmlFor="password" required hint={PASSWORD_HINT} error={errors.password}>
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

      <Field label="Пароль ещё раз" htmlFor="repeat" required error={errors.repeat}>
        <PasswordInput
          id="repeat"
          name="repeat"
          autoComplete="new-password"
          required
          aria-invalid={errors.repeat ? true : undefined}
          aria-describedby={describedBy("repeat", { error: errors.repeat })}
          onChange={() => clear("repeat")}
          onBlur={(event) => {
            const form = event.currentTarget.form;
            if (!form || !event.currentTarget.value) return;
            const { password, repeat } = readForm(form);
            check(event, "repeat", password === repeat ? null : "Пароли не совпадают.");
          }}
        />
      </Field>

      <div className="space-y-1.5">
        <div className="flex items-start gap-3">
          <input
            id="terms"
            name="terms"
            type="checkbox"
            required
            // После ответа сервера React сбрасывает форму; согласие, которое
            // уже дали, не должно сниматься из-за ошибки в другом поле.
            defaultChecked={state.status === "error" && !state.fieldErrors.terms}
            aria-invalid={errors.terms ? true : undefined}
            aria-describedby={describedBy("terms", { error: errors.terms })}
            onChange={() => clear("terms")}
            // 24 px — минимальная цель касания (WCAG 2.2, 2.5.8).
            className="size-6 shrink-0 accent-signal"
          />
          <label htmlFor="terms" className="text-[14px] leading-[1.45] text-ink-soft">
            Мне есть {MIN_AGE}, я принимаю{" "}
            <Link href="/legal/terms" className="text-signal underline underline-offset-2">
              условия
            </Link>{" "}
            и{" "}
            <Link href="/legal/community" className="text-signal underline underline-offset-2">
              правила сообщества
            </Link>{" "}
            и знаю,{" "}
            <Link href="/legal/privacy" className="text-signal underline underline-offset-2">
              как обращаются с данными
            </Link>
            .
          </label>
        </div>
        {errors.terms ? (
          <p id="terms-error" role="alert" className="pl-9 text-[12px] text-heat">
            {errors.terms}
          </p>
        ) : null}
      </div>

      {state.formError ? (
        <FormError id="signup-error" ref={alertRef}>
          {state.formError}
        </FormError>
      ) : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Создаём аккаунт…" : "Создать аккаунт"}
      </Button>

      <p className="text-center text-[14px] text-ink-soft">
        Уже есть аккаунт?{" "}
        <Link
          href={next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"}
          className="text-signal underline underline-offset-2"
        >
          Войти
        </Link>
      </p>
    </form>
  );
}
