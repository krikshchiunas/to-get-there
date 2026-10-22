"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { describedBy, Field, TextInput } from "@/components/ui/field";
import { linkErrorFromHash } from "@/lib/auth/errors";
import { initialFormState, type FormState } from "@/lib/auth/form-state";
import { emailProblem, normalizeEmail, validateLogin, type LoginField } from "@/lib/auth/validation";
import { FormError, FormNotice } from "./form-message";
import { PasswordInput } from "./password-input";
import { useFormErrors } from "./use-form-errors";

const ORDER: readonly LoginField[] = ["email", "password"];

export function LoginForm({
  next,
  notice,
}: {
  /** Куда вернуть после входа — экран, с которого человека увёл middleware. */
  next?: string;
  /** Сообщение сверху: «ссылка устарела», «ты вышел», «сессия закончилась». */
  notice?: string | null;
}) {
  const [state, submit, pending] = useActionState(signIn, initialFormState as FormState<LoginField>);
  const { errorOf, clear, check, guard, alertRef } = useFormErrors(state, ORDER);
  const emailError = errorOf("email");
  const passwordError = errorOf("password");
  const [linkNotice, setLinkNotice] = useState<string | null>(null);

  // Устаревшая ссылка из письма приходит сюда с ошибкой во фрагменте адреса
  // (см. linkErrorFromHash). Объясняем и убираем фрагмент из адресной строки.
  useEffect(() => {
    const kind = linkErrorFromHash(window.location.hash);
    if (!kind) return;
    setLinkNotice(
      kind === "rate_limited"
        ? "Слишком много попыток открыть ссылку. Подожди несколько минут."
        : "Ссылка из письма устарела или уже использована. Если это было подтверждение почты — просто войди. Если сброс пароля — запроси новое письмо.",
    );
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  const shownNotice = notice ?? linkNotice;

  return (
    <form
      action={submit}
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        guard(
          event,
          validateLogin({
            email: normalizeEmail(data.get("email")),
            password: String(data.get("password") ?? ""),
          }),
        );
      }}
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {shownNotice && state.status === "idle" ? <FormNotice>{shownNotice}</FormNotice> : null}

      <Field label="Почта" htmlFor="email" required error={emailError}>
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
          aria-invalid={emailError ? true : undefined}
          aria-describedby={describedBy("email", { error: emailError })}
          onChange={() => clear("email")}
          onBlur={(event) => {
            const value = normalizeEmail(event.currentTarget.value);
            if (value) check(event, "email", emailProblem(value));
          }}
        />
      </Field>

      <Field label="Пароль" htmlFor="password" required error={passwordError}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={describedBy("password", { error: passwordError })}
          onChange={() => clear("password")}
        />
      </Field>

      <p className="-mt-2 text-right text-[14px]">
        <Link href="/auth/forgot" className="text-signal underline underline-offset-2">
          Забыли пароль?
        </Link>
      </p>

      {state.formError ? (
        <FormError id="login-error" ref={alertRef}>
          {state.formError}
          {state.unconfirmed ? (
            <>
              {" "}
              <Link href="/auth/check-email" className="underline underline-offset-2">
                Отправить письмо ещё раз
              </Link>
            </>
          ) : null}
        </FormError>
      ) : null}

      <Button
        type="submit"
        size="lg"
        full
        disabled={pending}
        aria-describedby={state.formError ? "login-error" : undefined}
      >
        {pending ? "Входим…" : "Войти"}
      </Button>

      <p className="text-center text-[14px] text-ink-soft">
        Ещё нет аккаунта?{" "}
        <Link
          href={next ? `/auth/signup?next=${encodeURIComponent(next)}` : "/auth/signup"}
          className="text-signal underline underline-offset-2"
        >
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}
