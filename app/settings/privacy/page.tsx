import type { Metadata } from "next";
import { PrivacyForm } from "@/components/settings/privacy-form";
import { PageHeader } from "@/components/ui/page-header";
import { currentUser } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Приватность",
  description: "Кто видит твой профиль, интересы и кто может тебе написать.",
};

export default function PrivacySettingsPage() {
  return (
    <>
      <PageHeader
        title="Приватность"
        subtitle="Кто видит тебя и кто может писать"
        backHref="/settings"
      />
      <PrivacyForm user={currentUser} />
    </>
  );
}
