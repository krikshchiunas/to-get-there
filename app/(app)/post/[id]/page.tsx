import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdeaDetail } from "@/components/chat/idea-detail";
import {
  CHAT_HISTORY_LIMIT,
  canEnterChat,
  chatAccessReason,
  getViewer,
  getMessages,
  getParticipants,
  getPolls,
  getPost,
  getViewerPermissions,
} from "@/lib/data";

/** The page says how long is left until the start, so it is rendered per request. */
export const dynamic = "force-dynamic";

type IdeaPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: IdeaPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) return { title: "Идея не найдена" };

  return {
    title: post.title,
    description: post.description,
  };
}

/**
 * The idea: its details, its group chat, its polls, its participants.
 *
 * Everything the chat needs is read here in one pass — the roster, the
 * thread, the polls and the viewer's moderator rights — and handed down as
 * props, so the client half never touches the data layer. The clock is read
 * once and passed along with it.
 */
export default async function IdeaPage({ params }: IdeaPageProps) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) notFound();

  const now = new Date();
  // Независимые чтения — параллельно: страница ждёт самое долгое, а не сумму.
  const [viewer, participants, messages, polls, permissions] = await Promise.all([
    getViewer(),
    getParticipants(post.id),
    getMessages(post.id),
    getPolls(post.id),
    getViewerPermissions(post.id),
  ]);

  return (
    <IdeaDetail
      post={post}
      viewer={viewer}
      participants={participants}
      messages={messages}
      polls={polls}
      permissions={permissions}
      canEnter={canEnterChat(post)}
      accessReason={chatAccessReason(post)}
      historyLimited={messages.length >= CHAT_HISTORY_LIMIT}
      now={now}
    />
  );
}
