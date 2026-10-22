"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions/account";
import { ConfirmSheet } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";

/**
 * Свои данные (DSGVO ст. 15, 17, 20): скачать копию и удалить аккаунт.
 *
 * Удаление — через лист с набранным ником и паролем. Как у GitHub:
 * подтверждение руками, а не одной кнопкой, потому что вернуть ничего не
 * получится; пароль — потому что открытая сессия ещё не значит, что за
 * экраном владелец.
 */
export function AccountData({ nickname, demo }: { nickname: string; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = typed.trim().toLowerCase() === nickname;
  const ready = matches && password.length > 0;

  function remove() {
    setError(null);
    startTransition(async () => {
      // При успехе действие перенаправляет на вход и сюда не возвращается.
      const result = await deleteAccount(typed, password);
      if (result && !result.ok) {
        setError(result.error);
        setPassword("");
      }
    });
  }

  return (
    <div className="pb-10">
      <section>
        <h2 className="px-4 pt-6 pb-2 text-[13px] font-medium text-ink-faint">Копия твоих данных</h2>
        <div className="px-4">
          <p className="text-[14px] leading-[1.45] text-ink-soft">
            Один файл JSON: профиль и настройки, твои идеи, сообщения в чатах и в личке, подписки, голоса,
            жалобы и уведомления. Подходит, чтобы сохранить себе или перенести в другой сервис.
          </p>
          {demo ? (
            <p className="mt-3 text-[14px] text-ink-soft">В демо без базы выгружать нечего.</p>
          ) : (
            <a
              href="/api/account/export"
              download
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-pill bg-sunken px-5 text-[15px] text-ink transition-colors hover:bg-line"
            >
              <Icon name="download" size={18} />
              Скачать мои данные
            </a>
          )}
        </div>
      </section>

      <section>
        <h2 className="px-4 pt-8 pb-2 text-[13px] font-medium text-ink-faint">Удаление аккаунта</h2>
        <div className="px-4">
          <p className="text-[14px] leading-[1.45] text-ink-soft">
            Удалятся профиль, все твои идеи вместе с их чатами, твои сообщения, подписки, голоса и фото.
            Восстановить аккаунт будет нельзя. Если нужна копия — сначала скачай данные.
          </p>
          <Button type="button" variant="danger" size="lg" className="mt-3" onClick={() => setOpen(true)}>
            Удалить аккаунт
          </Button>
        </div>
      </section>

      <ConfirmSheet
        open={open}
        onClose={() => {
          setOpen(false);
          setTyped("");
          setPassword("");
          setError(null);
        }}
        title="Удалить аккаунт навсегда?"
        confirmLabel="Удалить аккаунт"
        onConfirm={() => {
          if (ready) remove();
        }}
        pending={pending}
        confirmDisabled={!ready}
      >
        <p>Это нельзя отменить. Чтобы подтвердить, набери свой ник: {nickname} — и пароль.</p>
        <Field label="Ник" htmlFor="delete-confirm" required>
          <TextInput
            id="delete-confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={nickname}
          />
        </Field>
        <Field label="Пароль" htmlFor="delete-password" required error={error ?? undefined}>
          <PasswordInput
            id="delete-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "delete-password-error" : undefined}
          />
        </Field>
      </ConfirmSheet>
    </div>
  );
}
