"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import {
  checkSignIn,
  checkSignUp,
  MIN_PASSWORD,
  normalizeEmail,
  type CredentialField,
} from "@/lib/auth/credentials";
import { MIN_AGE } from "@/lib/legal";
import type { AuthState } from "@/app/auth/actions";
import { PasswordInput } from "./password-input";

type Action = (state: AuthState, form: FormData) => Promise<AuthState>;

const ERROR_ID = "auth-error";

/**
 * Вход и регистрация — одна форма: поля почти одинаковые.
 *
 * Проверка — дважды. В браузере — те же правила, что на сервере
 * (lib/auth/credentials.ts): ошибка видна сразу, без запроса. На сервере —
 * потому что браузеру верить нельзя. После ошибки фокус уходит в поле, к
 * которому она относится, а сам текст — в role="alert", связанный с полем
 * через aria-describedby. Пока запрос идёт, кнопка выключена: дважды
 * форма не уйдёт.
 *
 * autoComplete: «username» у почты и «current-password» / «new-password» у
 * пароля — так менеджеры паролей (iCloud, 1Password, Bitwarden, Chrome)
 * узнают форму входа и предлагают сохранить и сгенерировать пароль.
 */
export function AuthForm({
  mode,
  action,
  next,
  notice,
}: {
  mode: "login" | "signup";
  action: Action;
  /** Куда вернуть после входа — экран, с которого человека увёл middleware. */
  next?: string;
  /** Сообщение сверху, например «ссылка из письма устарела». */
  notice?: string | null;
}) {
  const [state, submit, pending] = useActionState(action, { error: null, field: null, email: "" });
  const [local, setLocal] = useState<{ error: string; field: CredentialField | null } | null>(null);
  const isSignup = mode === "signup";

  const refs = {
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    repeat: useRef<HTMLInputElement>(null),
  };
  const errorRef = useRef<HTMLParagraphElement>(null);

  const shown = local ?? (state.error ? { error: state.error, field: state.field } : null);

  function focusProblem(field: CredentialField | null) {
    const target = field ? refs[field].current : errorRef.current;
    target?.focus();
  }

  // Ответ сервера с ошибкой — фокус туда, где её исправлять.
  useEffect(() => {
    if (state.error) focusProblem(state.field);
    // refs стабильны; реагируем только на новый ответ сервера.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const email = normalizeEmail(data.get("email"));
    const password = String(data.get("password") ?? "");
    const problem = isSignup
      ? checkSignUp(email, password, String(data.get("repeat") ?? ""))
      : checkSignIn(email, password);

    if (problem) {
      event.preventDefault();
      setLocal({ error: problem.message, field: problem.field });
      focusProblem(problem.field);
      return;
    }
    setLocal(null);
  }

  /** Связь поля с ошибкой: только у того поля, к которому она относится. */
  function errorProps(field: CredentialField) {
    const mine = shown !== null && shown.field === field;
    return {
      "aria-invalid": mine ? true : undefined,
      "aria-describedby": mine ? ERROR_ID : undefined,
    } as const;
  }

  return (
    <form action={submit} onSubmit={handleSubmit} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {notice && !shown ? (
        <p
          role="status"
          className="rounded-field bg-sunken px-4 py-3 text-[14px] leading-[1.4] text-ink-soft"
        >
          {notice}
        </p>
      ) : null}

      <Field
        label="Почта"
        htmlFor="email"
        required
        hint={isSignup ? "Если почта — на домене вуза из списка, вуз сам появится в профиле." : undefined}
      >
        <TextInput
          ref={refs.email}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email}
          placeholder="имя@почта.de"
          required
          {...errorProps("email")}
        />
      </Field>

      <Field
        label="Пароль"
        htmlFor="password"
        required
        hint={
          isSignup
            ? `Не короче ${MIN_PASSWORD} символов. Проще всего — пусть его придумает менеджер паролей.`
            : undefined
        }
      >
        <PasswordInput
          ref={refs.password}
          id="password"
          name="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? MIN_PASSWORD : undefined}
          required
          {...errorProps("password")}
        />
      </Field>

      {isSignup ? (
        <Field label="Пароль ещё раз" htmlFor="repeat" required>
          <PasswordInput
            ref={refs.repeat}
            id="repeat"
            name="repeat"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
            {...errorProps("repeat")}
          />
        </Field>
      ) : (
        <p className="-mt-2 text-right text-[14px]">
          <Link href="/auth/forgot" className="text-signal underline underline-offset-2">
            Забыли пароль?
          </Link>
        </p>
      )}

      {shown ? (
        <p
          ref={errorRef}
          id={ERROR_ID}
          role="alert"
          tabIndex={-1}
          className="text-[14px] leading-[1.4] text-heat outline-none"
        >
          {shown.error}
          {!local && state.unconfirmed ? (
            <>
              {" "}
              <Link href="/auth/check-email" className="text-signal underline underline-offset-2">
                Отправить письмо ещё раз
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {isSignup ? (
        <p className="text-[13px] leading-[1.45] text-ink-soft">
          Создавая аккаунт, ты подтверждаешь, что тебе есть {MIN_AGE}, и принимаешь{" "}
          <Link href="/legal/terms" className="text-signal underline underline-offset-2">
            условия
          </Link>{" "}
          и{" "}
          <Link href="/legal/community" className="text-signal underline underline-offset-2">
            правила сообщества
          </Link>
          . Как мы обращаемся с данными —{" "}
          <Link href="/legal/privacy" className="text-signal underline underline-offset-2">
            здесь
          </Link>
          .
        </p>
      ) : null}

      <Button type="submit" size="lg" full disabled={pending} aria-busy={pending || undefined}>
        {pending ? (isSignup ? "Создаём аккаунт…" : "Входим…") : isSignup ? "Создать аккаунт" : "Войти"}
      </Button>

      <p className="text-center text-[14px] text-ink-soft">
        {isSignup ? "Уже есть аккаунт? " : "Ещё нет аккаунта? "}
        <Link
          href={isSignup ? "/auth/login" : "/auth/signup"}
          className="text-signal underline underline-offset-2"
        >
          {isSignup ? "Войти" : "Зарегистрироваться"}
        </Link>
      </p>
    </form>
  );
}
