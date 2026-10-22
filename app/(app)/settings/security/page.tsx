import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { ChangePasswordForm, SignOutEverywhereForm } from "@/components/settings/security-forms";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getAccount, getViewer, usingMocks } from "@/lib/data";
import { formatCalendarDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Вход и безопасность",
  description: "Почта аккаунта, пароль и выход на всех устройствах.",
};

/**
 * Аккаунт, а не профиль: почта, с которой входят, пароль и сессии. Почта
 * приходит из Supabase Auth и видна только владельцу.
 */
export default async function SecurityPage() {
  const [account, viewer] = await Promise.all([getAccount(), getViewer()]);

  return (
    <>
      <PageHeader title="Вход и безопасность" subtitle="Почта, пароль и выход" backHref="/settings" />

      <div className="pb-10">
        <Section title="Аккаунт">
          <dl className="space-y-3 text-[15px]">
            <Row label="Почта для входа">
              <span className="break-all">{account.email}</span>
            </Row>
            <Row label="Почта подтверждена">
              {account.email_confirmed_at ? formatCalendarDate(account.email_confirmed_at) : "Нет"}
            </Row>
            <Row label="Аккаунт создан">{formatCalendarDate(account.created_at)}</Row>
          </dl>
          <p className="mt-4 text-[14px]">
            <Link href={`/u/${viewer.nickname}`} className="text-signal underline underline-offset-2">
              Открыть профиль
            </Link>
          </p>
        </Section>

        <Section
          title="Пароль"
          description="Пароль хранит Supabase Auth в виде хеша — мы его не видим и не храним. После смены на других устройствах нужно будет войти заново."
        >
          <ChangePasswordForm email={account.email} demo={usingMocks} />
        </Section>

        <Section
          title="Выход"
          description="«Выйти» закрывает аккаунт на этом устройстве. «Выйти на всех устройствах» — везде, где ты входил, включая это: пригодится, если забыл выйти на чужом компьютере."
        >
          <div className="flex flex-wrap gap-3">
            <form action={signOut}>
              <Button type="submit" variant="quiet" size="md" disabled={usingMocks}>
                Выйти
              </Button>
            </form>
            <SignOutEverywhereForm demo={usingMocks} />
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="u-feed-divider px-4 pt-6 pb-6">
      <h2 className="pb-2 text-[13px] font-medium text-ink-faint">{title}</h2>
      {description ? <p className="pb-4 text-[14px] leading-[1.45] text-ink-soft">{description}</p> : null}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-soft">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
