import type { Metadata } from "next";
import { VerificationFlow } from "@/components/settings/verification-flow";
import { PageHeader } from "@/components/ui/page-header";
import { getLatestVerification, getViewer } from "@/lib/data";
import { identityConfigured } from "@/lib/stripe-identity";

export const metadata: Metadata = {
  title: "Верификация",
  description: "Добровольная проверка личности. Привилегий не даёт.",
};

/** Статус заявки меняет вебхук — страница всегда свежая. */
export const dynamic = "force-dynamic";

export default async function VerificationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [viewer, state, params] = await Promise.all([getViewer(), getLatestVerification(), searchParams]);
  return (
    <>
      <PageHeader
        title="Верификация"
        subtitle="Добровольно и без привилегий"
        backHref="/settings"
      />
      <VerificationFlow
        user={viewer}
        state={state}
        available={identityConfigured()}
        returned={params.from === "provider"}
      />
    </>
  );
}
