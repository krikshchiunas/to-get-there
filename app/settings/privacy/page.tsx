import type { Metadata } from "next";
import { PrivacyForm } from "@/components/settings/privacy-form";
import { PageHeader } from "@/components/ui/page-header";
import { getViewer } from "@/lib/data";

export const metadata: Metadata = {
  title: "Приватность",
  description: "Кто видит твой профиль, интересы и кто может тебе написать.",
};

export default async function PrivacySettingsPage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader
        title="Приватность"
        subtitle="Кто видит тебя и кто может писать"
        backHref="/settings"
      />
      <PrivacyForm user={viewer} />
    </>
  );
}
