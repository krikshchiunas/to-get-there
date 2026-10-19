import type { Metadata } from "next";
import { VerificationFlow } from "@/components/settings/verification-flow";
import { PageHeader } from "@/components/ui/page-header";
import { getViewer } from "@/lib/data";

export const metadata: Metadata = {
  title: "Верификация",
  description: "Добровольная проверка личности. Привилегий не даёт.",
};

export default async function VerificationSettingsPage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader
        title="Верификация"
        subtitle="Добровольно и без привилегий"
        backHref="/settings"
      />
      <VerificationFlow user={viewer} />
    </>
  );
}
