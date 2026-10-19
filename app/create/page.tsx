import type { Metadata } from "next";
import { CreateForm } from "@/components/create/create-form";
import { PageHeader } from "@/components/ui/page-header";
import { getCategories, getCitiesWithPosts, getViewer } from "@/lib/data";

export const metadata: Metadata = {
  title: "Новая идея",
};

/** The default departure is derived from the current time, so never cached. */
export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const now = new Date();

  const [viewer, categories, cities] = await Promise.all([
    getViewer(),
    getCategories(),
    getCitiesWithPosts(),
  ]);

  return (
    <>
      <PageHeader title="Новая идея" backHref="/" />
      <CreateForm now={now} viewer={viewer} categories={categories} cities={cities} />
    </>
  );
}
