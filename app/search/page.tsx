import type { Metadata } from "next";
import { SearchScreen, type SearchTab } from "@/components/search/search-screen";
import { PageHeader } from "@/components/ui/page-header";

/** Results depend on the clock, so it is read once per request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Поиск",
  description: "Найди идею по слову, категории, дате, времени суток и месту — или человека по нику.",
};

function tabFrom(value: string | string[] | undefined): SearchTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "people" ? "people" : "ideas";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();

  return (
    <>
      <PageHeader title="Поиск" />
      <SearchScreen nowIso={now.toISOString()} tab={tabFrom(params.tab)} />
    </>
  );
}
