import type { Metadata } from "next";
import { CreateForm } from "@/components/create/create-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Новая идея",
};

/** The default departure is derived from the current time, so never cached. */
export const dynamic = "force-dynamic";

export default function CreatePage() {
  const now = new Date();

  return (
    <>
      <PageHeader title="Новая идея" backHref="/" />
      <CreateForm now={now} />
    </>
  );
}
