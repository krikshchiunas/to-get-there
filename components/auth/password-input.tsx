"use client";

import { useState, type InputHTMLAttributes, type Ref } from "react";
import { TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";

/**
 * Поле пароля с кнопкой «Показать пароль».
 *
 * Кнопка — переключатель (aria-pressed) с постоянным именем, а не кнопка,
 * которая меняет подпись: читалка скажет «Показать пароль, нажата», и это
 * понятнее, чем имя, которое вдруг стало другим. Цель нажатия — 44×44.
 * `autoComplete` остаётся прежним в обоих режимах, чтобы менеджеры
 * паролей (iCloud, 1Password, Bitwarden, Chrome) не потеряли поле.
 */
export function PasswordInput({
  id,
  ref,
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string; ref?: Ref<HTMLInputElement> }) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <TextInput
        id={id}
        ref={ref}
        type={shown ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`pr-12 ${className}`}
        {...rest}
      />
      <button
        type="button"
        aria-label="Показать пароль"
        aria-pressed={shown}
        aria-controls={id}
        onClick={() => setShown((value) => !value)}
        className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-field text-ink-soft transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-signal/35 focus-visible:outline-none"
      >
        <Icon name={shown ? "eye-off" : "eye"} size={19} />
      </button>
    </div>
  );
}
