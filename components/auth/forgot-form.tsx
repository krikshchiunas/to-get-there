"use client";

import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import { EmailForm } from "./email-form";

/** Почта для письма со ссылкой восстановления. */
export function ForgotForm({ notice }: { notice?: string | null }) {
  return (
    <EmailForm
      id="forgot"
      action={requestPasswordReset}
      submitLabel="Прислать ссылку"
      pendingLabel="Отправляем…"
      notice={notice}
      footer={
        <p className="text-center text-[14px] text-ink-soft">
          Вспомнил пароль?{" "}
          <Link href="/auth/login" className="text-signal underline underline-offset-2">
            Войти
          </Link>
        </p>
      }
    />
  );
}
