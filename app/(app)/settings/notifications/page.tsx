import type { Metadata } from "next";
import { NotificationForm } from "@/components/settings/notification-form";
import { PageHeader } from "@/components/ui/page-header";
import { getViewer } from "@/lib/data";

export const metadata: Metadata = {
  title: "Уведомления",
  description: "О чём приложение сообщает, а о чём молчит.",
};

export default async function NotificationSettingsPage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader title="Уведомления" subtitle="О чём сообщать, а о чём молчать" backHref="/settings" />
      <NotificationForm user={viewer} />
    </>
  );
}
