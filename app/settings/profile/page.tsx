import type { Metadata } from "next";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageHeader } from "@/components/ui/page-header";
import { currentUser } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Профиль",
  description: "Ник, факультет, описание, интересы и цели.",
};

export default function ProfileSettingsPage() {
  return (
    <>
      <PageHeader
        title="Профиль"
        subtitle="Это видят другие студенты"
        backHref="/settings"
      />
      <ProfileForm user={currentUser} />
    </>
  );
}
