import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, recoveryMatches } from "@/lib/recovery";

export const metadata: Metadata = { title: "Новый пароль" };

/**
 * Форма нового пароля. Открывается только по свежей ссылке из письма:
 * без метки восстановления (lib/recovery.ts) — объяснение и путь назад.
 */
export default async function ResetPage() {
  const store = await cookies();
  const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";
  let allowed = false;
  let email: string | null = null;
  if (!usingMocks) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    allowed = recoveryMatches(store.get(RECOVERY_COOKIE)?.value, user?.id);
    email = user?.email ?? null;
  }

  if (!allowed) {
    return (
      <>
        <h1 className="mb-2 text-[24px] font-semibold">Ссылка устарела</h1>
        <p className="text-[15px] leading-[1.5] text-ink-soft">
          Задать новый пароль можно только по свежей ссылке из письма: после перехода по ней на это есть 15
          минут.
        </p>
        <Link
          href="/auth/forgot"
          className="mt-8 inline-block text-[15px] text-signal underline underline-offset-2"
        >
          Запросить новое письмо
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Новый пароль</h1>
      <p className="mb-8 text-[15px] leading-[1.4] text-ink-soft">
        {email ? (
          <>
            Для аккаунта <span className="break-all text-ink">{email}</span>.{" "}
          </>
        ) : null}
        Придумай пароль, которого нет на других сайтах. После сохранения на других устройствах нужно будет
        войти заново.
      </p>
      <NewPasswordForm email={email} />
    </>
  );
}
