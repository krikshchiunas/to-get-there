import type { Metadata } from "next";
import { BlockedList } from "@/components/settings/blocked-list";
import { PageHeader } from "@/components/ui/page-header";
import { getBlockedUsers } from "@/lib/data";

export const metadata: Metadata = {
  title: "Заблокированные",
  description: "Люди, которых ты заблокировал.",
};

export const dynamic = "force-dynamic";

export default async function BlockedPage() {
  const users = await getBlockedUsers();
  return (
    <>
      <PageHeader title="Заблокированные" subtitle="Они не видят тебя и не могут писать" backHref="/settings" />
      <p className="px-4 pt-4 pb-2 text-[14px] leading-[1.4] text-ink-soft">
        Заблокированный не видит твой профиль, идеи и сообщения в общих чатах, не может тебе писать и
        подписываться. О блокировке он не узнает.
      </p>
      <BlockedList users={users} />
    </>
  );
}
