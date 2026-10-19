import type { Metadata } from "next";
import {
  MarkAllReadButton,
  NotificationFeed,
  NotificationsProvider,
  type NotificationItem,
} from "@/components/notifications/notification-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { getNotifications, getUserById } from "@/lib/mock";

/** Строки показывают, сколько времени прошло, поэтому экран не кэшируется. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Уведомления",
  description: "Кто присоединился, кто написал и что скоро начинается.",
};

export default function NotificationsPage() {
  /** Актор разрешается здесь, на сервере: клиенту нужен только его профиль. */
  const items: NotificationItem[] = getNotifications().map((notification) => {
    const actorId = notification.payload.actor_id;
    return {
      notification,
      actor: actorId ? (getUserById(actorId) ?? null) : null,
    };
  });

  if (items.length === 0) {
    return (
      <>
        <PageHeader title="Уведомления" backHref="/" />
        <EmptyState
          icon="bell"
          title="Пока тихо"
          body="Здесь появится, кто зашёл в чат твоей идеи и что начинается в ближайший час. Начни с идеи."
          action={<ButtonLink href="/create">Создать идею</ButtonLink>}
        />
      </>
    );
  }

  return (
    <NotificationsProvider items={items}>
      <PageHeader title="Уведомления" backHref="/" action={<MarkAllReadButton />} />
      <NotificationFeed />
    </NotificationsProvider>
  );
}
