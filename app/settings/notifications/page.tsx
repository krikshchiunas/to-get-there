import type { Metadata } from "next";
import { NotificationForm } from "@/components/settings/notification-form";
import { PageHeader } from "@/components/ui/page-header";
import { currentUser } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Уведомления",
  description: "О чём приложение сообщает, а о чём молчит.",
};

export default function NotificationSettingsPage() {
  return (
    <>
      <PageHeader
        title="Уведомления"
        subtitle="О чём сообщать, а о чём молчать"
        backHref="/settings"
      />
      <NotificationForm user={currentUser} />
    </>
  );
}
