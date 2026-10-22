import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SettingsLink } from "@/components/settings/settings-link";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { getViewer } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Настройки",
  description: "Профиль, приватность, уведомления и верификация.",
};

export default async function SettingsPage() {
  const viewer = await getViewer();
  const verified = viewer.is_verified;

  return (
    <>
      <PageHeader title="Настройки" backHref="/" />

      {/* Хаб — это список: сам пользователь такая же строка, как разделы под
          ним. Карточка профиля сверху делала из одного экрана два языка. */}
      <div className="pb-10">
        <Link
          href={`/u/${viewer.nickname}`}
          className="u-feed-divider flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken"
        >
          <Avatar user={viewer} size="md" withBadge />

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{viewer.nickname}</span>
            <span className="block truncate text-[14px] text-ink-soft">
              {viewer.university?.name ?? "Без вуза"}
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

        <Group title="Безопасность и данные">
          <SettingsLink
            href="/settings/blocked"
            icon="block"
            label="Заблокированные"
            description="Кого ты заблокировал и как это снять."
          />
          <SettingsLink
            href="/settings/account"
            icon="download"
            label="Данные и аккаунт"
            description="Скачать копию своих данных или удалить аккаунт."
          />
        </Group>

        <Group title="Правила и документы">
          <SettingsLink
            href="/legal/community"
            icon="heart"
            label="Правила сообщества"
            description="Что здесь можно, что нельзя и что бывает за нарушения."
          />
          <SettingsLink
            href="/legal/privacy"
            icon="lock"
            label="Конфиденциальность"
            description="Какие данные мы храним, зачем и сколько. Datenschutzerklärung."
          />
          <SettingsLink
            href="/legal/terms"
            icon="note"
            label="Условия использования"
            description="Nutzungsbedingungen."
          />
          <SettingsLink
            href="/legal/impressum"
            icon="book"
            label="Impressum"
            description="Кто отвечает за сервис."
          />
        </Group>

        <Group
          title="Аккаунт"
          description={
            viewer.university
              ? "Университет закреплён за аккаунтом по почте, с которой ты регистрировался: он решает, какую ленту «Университет» ты видишь."
              : "Вуз подставляется сам, если почта — на домене вуза из списка. Без вуза вместо ленты «Университет» — лента «Все»."
          }
        >
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft">
              <Icon name="book" size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px]">{viewer.university?.name ?? "Без вуза"}</span>
              <span className="block text-[14px] text-ink-soft">
                {viewer.university
                  ? `Почта на домене ${viewer.university.domain}`
                  : "Почта не на домене вуза из списка"}
              </span>
            </span>
          </div>

          <form action={signOut} className="px-4 py-3">
            <Button type="submit" variant="danger" size="md" full>
              Выйти
            </Button>
          </form>
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
