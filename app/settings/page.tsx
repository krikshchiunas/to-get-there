import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SettingsLink, SettingsRowSoon } from "@/components/settings/settings-link";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { currentUser } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Настройки",
  description: "Профиль, приватность, уведомления и верификация.",
};

export default function SettingsPage() {
  const verified = currentUser.is_verified;

  return (
    <>
      <PageHeader title="Настройки" backHref="/" />

      {/* Хаб — это список: сам пользователь такая же строка, как разделы под
          ним. Карточка профиля сверху делала из одного экрана два языка. */}
      <div className="pb-10">
        <Link
          href={`/u/${currentUser.nickname}`}
          className="u-feed-divider flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken"
        >
          <Avatar user={currentUser} size="md" withBadge />

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{currentUser.nickname}</span>
            <span className="block truncate text-[14px] text-ink-soft">
              {currentUser.university.name}
            </span>
          </span>

          <Icon name="chevron" size={18} className="shrink-0 text-ink-faint" />
        </Link>

        <Group title="Твой аккаунт">
          <SettingsLink
            href="/settings/profile"
            icon="person"
            label="Профиль"
            description="Ник, факультет, описание, интересы и цели."
          />
          <SettingsLink
            href="/settings/privacy"
            icon="lock"
            label="Приватность"
            description="Кто видит твой профиль и кто может тебе написать."
          />
          <SettingsLink
            href="/settings/notifications"
            icon="bell"
            label="Уведомления"
            description="О чём сообщать, а о чём молчать."
          />
          <SettingsLink
            href="/settings/verification"
            icon="shield"
            label="Верификация"
            description="Добровольная проверка личности. Привилегий не даёт."
            value={
              verified ? (
                <Pill tone="verified" icon="check">
                  Личность подтверждена
                </Pill>
              ) : (
                <Pill>Личность не подтверждена</Pill>
              )
            }
          />
        </Group>

        <Group
          title="Появится к запуску"
          description="Университетская почта и выход из аккаунта придут вместе с регистрацией на финальном этапе — пока входить некуда."
        >
          <SettingsRowSoon
            icon="book"
            label="Подтвердить университетскую почту"
            description={`Адрес вида имя@${currentUser.university.domain} — он решает, в какую ленту «Университет» ты попадаешь.`}
          />
          <SettingsRowSoon
            icon="close"
            label="Выйти"
            description="Пока приложение работает на тестовых данных, без входа."
          />
        </Group>
      </div>
    </>
  );
}

/** Группа разделов: заголовок, при нужде пояснение, и список строк. */
function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="px-4 pt-6 pb-2 text-[13px] font-medium text-ink-faint">{title}</h2>
      {description ? (
        <p className="px-4 pb-2 text-[14px] leading-[1.4] text-ink-soft">{description}</p>
      ) : null}
      <div className="u-feed">{children}</div>
    </section>
  );
}
