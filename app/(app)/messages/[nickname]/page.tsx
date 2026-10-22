import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Conversation } from "@/components/dm/conversation";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { canMessage, getPartnerReadAt, getThread, getUserByNickname, getViewer } from "@/lib/data";

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
  const [viewer, messages, partnerReadAt] = await Promise.all([
    getViewer(),
    getThread(partner.id),
    getPartnerReadAt(partner.id),
  ]);

  return (
    <>
      <PageHeader
        backHref="/messages"
        title={partner.nickname}
        subtitle={
          // Путь в профиль — текстом: его называют вслух и находят Tab'ом.
          <Link href={`/u/${partner.nickname}`} className="underline-offset-2 hover:text-ink hover:underline">
            {partner.university ? `${partner.university.short_name} · профиль` : "Профиль"}
          </Link>
        }
        action={
          // Аватар — тот же путь для пальца, для читалок — дубль (WCAG 2.5.3).
          <Link
            href={`/u/${partner.nickname}`}
            aria-hidden
            tabIndex={-1}
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
        partnerReadAt={partnerReadAt}
        now={now}
      />
    </>
  );
}
