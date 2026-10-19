import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Conversation } from "@/components/dm/conversation";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { canMessage, getThread, getUserByNickname, getViewer } from "@/lib/data";

/** Stamps and day dividers in the thread depend on the clock. */
export const dynamic = "force-dynamic";

type PageParams = { params: Promise<{ nickname: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { nickname } = await params;
  const partner = await getUserByNickname(nickname);

  if (!partner) {
    return { title: "Чат" };
  }

  return {
    title: partner.nickname,
    description: `Личные сообщения с ${partner.nickname}.`,
  };
}

export default async function DirectConversationPage({ params }: PageParams) {
  const { nickname } = await params;
  const partner = await getUserByNickname(nickname);

  if (!partner) {
    notFound();
  }

  const now = new Date();
  const [viewer, messages] = await Promise.all([await getViewer(), await getThread(partner.id)]);

  return (
    <>
      <PageHeader
        backHref="/messages"
        title={partner.nickname}
        subtitle={partner.university.short_name}
        action={
          <Link
            href={`/u/${partner.nickname}`}
            aria-label={`Профиль ${partner.nickname}`}
            className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-sunken"
          >
            <Avatar user={partner} size="sm" withBadge />
          </Link>
        }
      />

      <Conversation
        partner={partner}
        viewerId={viewer.id}
        messages={messages}
        canReply={canMessage(partner, viewer)}
        now={now}
      />
    </>
  );
}
