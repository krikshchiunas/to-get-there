import type { Metadata } from "next";
import { DirectChatList, IdeaChatList } from "@/components/dm/chat-list";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { getConversations, getMyIdeaChats, getViewer } from "@/lib/data";

/**
 * The chat list. Two kinds of room live here: the group chat of an idea,
 * which outlives the listing, and a conversation with one person.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Чаты",
  description: "Групповые чаты твоих идей и личные сообщения.",
};

type Tab = "ideas" | "direct";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const tab: Tab = requested === "direct" ? "direct" : "ideas";

  const now = new Date();
  const [viewer, ideaChats, conversations] = await Promise.all([
    getViewer(),
    getMyIdeaChats(),
    getConversations(),
  ]);
  const unreadDirect = conversations.reduce((sum, entry) => sum + entry.unread_count, 0);

  return (
    <>
      <PageHeader title="Чаты" />

      <Segmented
        ariaLabel="Разделы чатов"
        active={tab}
        items={[
          { value: "ideas", label: "Идеи", href: "/messages" },
          {
            value: "direct",
            label: "Личные",
            href: "/messages?tab=direct",
            count: unreadDirect,
          },
        ]}
      />

      {tab === "ideas" ? (
        <IdeaChatList chats={ideaChats} viewerId={viewer.id} now={now} />
      ) : (
        <DirectChatList conversations={conversations} viewerId={viewer.id} now={now} />
      )}
    </>
  );
}
