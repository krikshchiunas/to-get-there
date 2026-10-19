import type { Metadata } from "next";
import { AccountData } from "@/components/settings/account-data";
import { PageHeader } from "@/components/ui/page-header";
import { getViewer, usingMocks } from "@/lib/data";

export const metadata: Metadata = {
  title: "Данные и аккаунт",
  description: "Скачать копию своих данных или удалить аккаунт.",
};

export default async function AccountPage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader title="Данные и аккаунт" subtitle="Копия данных и удаление" backHref="/settings" />
      <AccountData nickname={viewer.nickname} demo={usingMocks} />
    </>
  );
}
