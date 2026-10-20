import type { Metadata } from "next";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageHeader } from "@/components/ui/page-header";
import { getViewer } from "@/lib/data";

export const metadata: Metadata = {
  title: "Профиль",
  description: "Ник, факультет, описание, интересы и цели.",
};

export default async function ProfileSettingsPage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader title="Профиль" subtitle="Это видят другие студенты" backHref="/settings" />
      <ProfileForm user={viewer} />
    </>
  );
}
