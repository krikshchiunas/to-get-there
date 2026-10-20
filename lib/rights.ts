import type { ChatRole, ModeratorPermissions } from "./types";

/**
 * What the viewer may do in this idea chat.
 *
 * Derived once from the role plus the per-person moderator rights; every
 * affordance in the chat is rendered from this object, so nothing is offered
 * and then refused. The author holds everything, a moderator holds exactly
 * what the author granted, a participant may send text.
 */
export interface Rights {
  role: ChatRole;
  isAuthor: boolean;
  canSend: boolean;
  canPostMedia: boolean;
  canPin: boolean;
  canPoll: boolean;
  canKick: boolean;
}

export function rightsOf(role: ChatRole, permissions: ModeratorPermissions | null): Rights {
  if (role === "author") {
    return {
      role,
      isAuthor: true,
      canSend: true,
      canPostMedia: true,
      canPin: true,
      canPoll: true,
      canKick: true,
    };
  }

  if (role === "moderator") {
    return {
      role,
      isAuthor: false,
      canSend: true,
      canPostMedia: permissions?.can_post_media ?? false,
      canPin: permissions?.can_pin ?? false,
      canPoll: permissions?.can_poll ?? false,
      canKick: permissions?.can_kick ?? false,
    };
  }

  return {
    role,
    isAuthor: false,
    canSend: role === "participant",
    canPostMedia: false,
    canPin: false,
    canPoll: false,
    canKick: false,
  };
}

export type MessageAction = "reply" | "copy" | "pin" | "unpin" | "delete" | "report";

/**
 * Что предложить в «⋯» у сообщения — ровно то, что разрешат политики:
 * ответить — тому, кто может писать; закрепить — с правом can_pin; удалить —
 * своё или любое, если ты автор идеи (messages_delete_own_or_author, 0008);
 * пожаловаться — на чужое (на своё база не примет, 0030).
 */
export function messageActions(
  message: { author_id: string; content: string; is_pinned: boolean },
  viewerId: string,
  rights: Pick<Rights, "isAuthor" | "canPin">,
  canSend: boolean,
): MessageAction[] {
  const own = message.author_id === viewerId;
  const actions: MessageAction[] = [];
  if (canSend) actions.push("reply");
  if (message.content.trim()) actions.push("copy");
  if (rights.canPin) actions.push(message.is_pinned ? "unpin" : "pin");
  if (own || rights.isAuthor) actions.push("delete");
  if (!own) actions.push("report");
  return actions;
}
