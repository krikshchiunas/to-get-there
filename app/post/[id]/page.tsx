import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdeaDetail } from "@/components/chat/idea-detail";
import {
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
  const viewer = await getViewer();

  return (
    <IdeaDetail
      post={post}
      viewer={viewer}
      participants={await getParticipants(post.id)}
      messages={await getMessages(post.id)}
      polls={await getPolls(post.id)}
      permissions={await getViewerPermissions(post.id)}
      canEnter={canEnterChat(post)}
      accessReason={chatAccessReason(post)}
      now={now}
    />
  );
}
