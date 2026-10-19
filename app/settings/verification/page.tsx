import type { Metadata } from "next";
import { VerificationFlow } from "@/components/settings/verification-flow";
import { PageHeader } from "@/components/ui/page-header";
import { currentUser } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Верификация",
  description: "Добровольная проверка личности. Привилегий не даёт.",
};

export default function VerificationSettingsPage() {
  return (
    <>
      <PageHeader
        title="Верификация"
        subtitle="Добровольно и без привилегий"
        backHref="/settings"
      />
      <VerificationFlow user={currentUser} />
    </>
  );
}
