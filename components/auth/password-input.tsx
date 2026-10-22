"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";

/**
 * Поле пароля с кнопкой «Показать пароль».
 *
 * Обычный <input type="password"> с настоящим autocomplete — иначе менеджеры
 * паролей (iCloud Keychain, 1Password, Bitwarden, Chrome) его не узнают.
 * Перед отправкой формы пароль снова скрывается: часть менеджеров решает,
 * что сохранять, по type=password в момент отправки.
 *
 * Кнопка — переключатель (aria-pressed) с постоянным названием: так читалка
 * говорит «Показать пароль, нажата», а не меняет название под пальцем.
 */
export function PasswordInput({
  id,
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string }) {
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <div className="relative">
      <TextInput
        ref={input}
        id={id}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`pr-12 ${className}`}
        {...rest}
      />
      <button
        type="button"
        aria-label="Показать пароль"
        aria-pressed={visible}
        aria-controls={id}
        onClick={() => setVisible((shown) => !shown)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-field text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name={visible ? "eye-off" : "eye"} size={20} />
      </button>
    </div>
  );
}
