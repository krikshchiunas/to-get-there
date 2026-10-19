"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPoll, sendMessage, setPinned, vote } from "@/app/actions/chat";
import { discardChatImage, uploadChatImage } from "@/lib/upload";
import { notify } from "@/components/ui/toast";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import type {
  ChatRole,
  MessageView,
  ModeratorPermissions,
  PollView,
  UserView,
} from "@/lib/types";
import { mergeById, useSyncedState } from "@/lib/use-synced-state";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import { PollComposer } from "./poll-composer";

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

function byCreatedAt(a: { created_at: string }, b: { created_at: string }): number {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/** Preview line for the pinned bar: media-only messages have no text. */
function previewOf(message: MessageView): string {
  const text = message.content.trim();
  if (text) return text;
  return message.media_url ? "Изображение" : "Сообщение";
}

export function ChatRoom({
  postId,
  viewer,
  rights,
  messages: seededMessages,
  polls: seededPolls,
  joined,
  onJoin,
  joinBlockedReason,
}: {
  postId: string;
  viewer: UserView;
  rights: Rights;
  messages: MessageView[];
  polls: PollView[];
  /** True once the viewer joined in this session. */
  joined: boolean;
  onJoin: () => void;
  /** Set when a guest may read but may not join — closed, over or full. */
  joinBlockedReason: string | null;
}) {
  // id, которые сервер уже подтвердил этому клиенту. Пока свежий снимок их
  // не принёс, они остаются на экране, а не мигают.
  const confirmed = useRef(new Set<string>());
  const [messages, setMessages] = useSyncedState<MessageView[]>(seededMessages, (server, local) =>
    mergeById(server, local, confirmed.current, byCreatedAt),
  );
  const [polls, setPolls] = useSyncedState<PollView[]>(seededPolls, (server, local) =>
    mergeById(server, local, confirmed.current, byCreatedAt),
  );
  const [pollOpen, setPollOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);

  const localCount = useRef(0);
  const flashTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  /** A guest who joined in this session may write like any participant. */
  const canSend = rights.canSend || joined;
  const pinned = messages.find((message) => message.is_pinned) ?? null;

  function nextLocalId(prefix: string): string {
    localCount.current += 1;
    return `${prefix}-local-${localCount.current}`;
  }

  function appendMessage(content: string, mediaUrl: string | null, mediaSrc: string | null = null) {
    const message: MessageView = {
      id: nextLocalId(postId),
      post_id: postId,
      author_id: viewer.id,
      content,
      media_url: mediaUrl,
      media_src: mediaSrc,
      is_pinned: false,
      created_at: new Date().toISOString(),
      author: viewer,
      role: rights.role === "guest" ? "participant" : rights.role,
    };
    setMessages((previous) => [...previous, message]);
    return message.id;
  }

  const [, startTransition] = useTransition();

  /** Убрать оптимистичное сообщение, если сервер его не принял. */
  function dropMessage(localId: string) {
    setMessages((previous) => previous.filter((message) => message.id !== localId));
  }

  function handleSend(text: string) {
    const localId = appendMessage(text, null);
    deliver(localId, () => sendMessage(postId, text));
  }

  /**
   * Фото видно в чате сразу — из памяти браузера, пока файл грузится.
   * Не загрузилось или сервер не принял сообщение — сообщение исчезает, а
   * уже загруженный файл удаляется, чтобы не висел сиротой.
   */
  function handleSendMedia(file: File, caption: string) {
    const preview = URL.createObjectURL(file);
    const localId = appendMessage(caption, "uploading", preview);
    deliver(localId, async () => {
      const upload = await uploadChatImage(file, postId);
      if (!upload.ok) return upload;
      const result = await sendMessage(postId, caption, upload.value);
      if (!result.ok) await discardChatImage(upload.value);
      return result;
    });
  }

  function deliver(
    localId: string,
    run: () => Promise<{ ok: true; data?: { id: string; created_at: string } } | { ok: false; error: string }>,
  ) {
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        dropMessage(localId);
        notify(result.error);
        return;
      }
      // Временный id меняется на настоящий — иначе закрепить его было бы нельзя.
      const real = result.data;
      if (real) {
        confirmed.current.add(real.id);
        setMessages((previous) =>
          // Снимок с сервера мог прийти раньше ответа — тогда копия лишняя.
          previous.some((message) => message.id === real.id)
            ? previous.filter((message) => message.id !== localId)
            : previous.map((message) =>
                message.id === localId ? { ...message, id: real.id, created_at: real.created_at } : message,
              ),
        );
      }
    });
  }

  function handleTogglePin(messageId: string) {
    const before = messages;
    const target = before.find((message) => message.id === messageId);
    if (!target) return;
    const pin = !target.is_pinned;

    startTransition(async () => {
      const result = await setPinned(postId, messageId, pin);
      if (!result.ok) {
        setMessages(before);
        notify(result.error);
      }
    });

    setMessages((previous) => {
      const target = previous.find((message) => message.id === messageId);
      if (!target) return previous;
      const pin = !target.is_pinned;
      return previous.map((message) => {
        if (message.id === messageId) return { ...message, is_pinned: pin };
        return message.is_pinned ? { ...message, is_pinned: false } : message;
      });
    });
  }

  function handleVote(pollId: string, optionIndex: number) {
    const before = polls;
    startTransition(async () => {
      const result = await vote(postId, pollId, optionIndex);
      if (!result.ok) {
        setPolls(before);
        notify(result.error);
      }
    });

    setPolls((previous) =>
      previous.map((poll) => {
        if (poll.id !== pollId) return poll;
        if (poll.viewer_choice === optionIndex) return poll;

        const tally = [...poll.tally];
        if (poll.viewer_choice !== null && poll.viewer_choice < tally.length) {
          tally[poll.viewer_choice] = Math.max(0, tally[poll.viewer_choice] - 1);
        }
        tally[optionIndex] = (tally[optionIndex] ?? 0) + 1;

        return {
          ...poll,
          tally,
          total_votes: tally.reduce((sum, votes) => sum + votes, 0),
          viewer_choice: optionIndex,
        };
      }),
    );
  }

  function handleCreatePoll(question: string, options: string[]) {
    const poll: PollView = {
      id: nextLocalId(`poll-${postId}`),
      post_id: postId,
      created_by: viewer.id,
      question,
      options: options.map((label) => ({ label })),
      created_at: new Date().toISOString(),
      author: viewer,
      tally: options.map(() => 0),
      total_votes: 0,
      viewer_choice: null,
    };
    setPolls((previous) => [...previous, poll]);
    setPollOpen(false);

    startTransition(async () => {
      const result = await createPoll(postId, question, options);
      if (!result.ok) {
        setPolls((previous) => previous.filter((item) => item.id !== poll.id));
        notify(result.error);
        return;
      }
      const real = result.data;
      if (real) {
        confirmed.current.add(real.id);
        setPolls((previous) =>
          previous.some((item) => item.id === real.id)
            ? previous.filter((item) => item.id !== poll.id)
            : previous.map((item) => (item.id === poll.id ? { ...item, id: real.id } : item)),
        );
      }
    });
  }

  function jumpToMessage(messageId: string) {
    document
      .getElementById(`msg-${messageId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });

    setFlashId(messageId);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 2000);
  }

  const empty = messages.length === 0 && polls.length === 0;

  return (
    <section aria-label="Групповой чат">
      <h2 className="px-4 pt-5 pb-2 text-[13px] font-medium text-ink-faint">Чат</h2>

      {pinned ? (
        <div className="sticky top-14 z-10 flex items-center gap-2 bg-sunken px-3 py-1.5">
          <Icon name="pin" size={15} className="shrink-0 text-ink-faint" />
          <button
            type="button"
            onClick={() => jumpToMessage(pinned.id)}
            className="min-h-10 min-w-0 flex-1 px-1 text-left"
          >
            <span className="block text-[12px] text-ink-soft">
              Закреплено: {pinned.author.nickname}
            </span>
            <span className="block truncate text-[14px]">{previewOf(pinned)}</span>
            <span className="sr-only">Перейти к закреплённому сообщению</span>
          </button>
          {rights.canPin ? (
            <IconButton
              type="button"
              variant="ghost"
              label="Открепить"
              onClick={() => handleTogglePin(pinned.id)}
            >
              <Icon name="close" size={17} />
            </IconButton>
          ) : null}
        </div>
      ) : null}

      {empty ? (
        <EmptyState
          icon="chat"
          title="Сообщений пока нет"
          body={
            canSend
              ? "Начни первым: напиши, когда будешь на месте и что взять с собой."
              : "Здесь договариваются, как всё пройдёт."
          }
        />
      ) : (
        <MessageList
          messages={messages}
          polls={polls}
          viewerId={viewer.id}
          canPin={rights.canPin}
          canVote={canSend}
          flashId={flashId}
          onTogglePin={handleTogglePin}
          onVote={handleVote}
        />
      )}

      <Composer
        canSend={canSend}
        canPostMedia={rights.canPostMedia}
        canPoll={rights.canPoll}
        joinBlockedReason={joinBlockedReason}
        onSend={handleSend}
        onSendMedia={handleSendMedia}
        onOpenPoll={() => setPollOpen(true)}
        onJoin={onJoin}
      />

      {rights.canPoll ? (
        <PollComposer
          open={pollOpen}
          onClose={() => setPollOpen(false)}
          onCreate={handleCreatePoll}
        />
      ) : null}
    </section>
  );
}
