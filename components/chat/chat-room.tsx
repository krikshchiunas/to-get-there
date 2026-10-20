"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPoll, deleteMessage, sendMessage, setPinned, vote } from "@/app/actions/chat";
import { discardChatImage, uploadChatImage } from "@/lib/upload";
import { notify } from "@/components/ui/toast";
import { ActionSheet, ConfirmSheet, type SheetAction } from "@/components/ui/action-sheet";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { ReportSheet } from "@/components/safety/report-sheet";
import { formatPresent, formatTyping } from "@/lib/format";
import type { MessageView, ParticipantView, PollView, ReplyPreview, UserView } from "@/lib/types";
import { messageActions, type Rights } from "@/lib/rights";
import { usePresence } from "@/lib/use-presence";
import { mergeById, useSyncedState } from "@/lib/use-synced-state";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import { PollComposer } from "./poll-composer";

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
  members,
  messages: seededMessages,
  polls: seededPolls,
  joined,
  onJoin,
  joinBlockedReason,
  historyLimited,
}: {
  postId: string;
  viewer: UserView;
  rights: Rights;
  /** Состав чата: кого показывать в «печатает» и «сейчас в чате». */
  members: ParticipantView[];
  messages: MessageView[];
  polls: PollView[];
  /** True once the viewer joined in this session. */
  joined: boolean;
  onJoin: () => void;
  /** Set when a guest may read but may not join — closed, over or full. */
  joinBlockedReason: string | null;
  /** История обрезана до последних сообщений (CHAT_HISTORY_LIMIT). */
  historyLimited: boolean;
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
  const [actionsFor, setActionsFor] = useState<MessageView | null>(null);
  const [deleting, setDeleting] = useState<MessageView | null>(null);
  const [reporting, setReporting] = useState<MessageView | null>(null);
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);

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

  const memberIds = useMemo(() => new Set(members.map((member) => member.user_id)), [members]);
  const nicknames = useMemo(
    () => new Map(members.map((member) => [member.user_id, member.user.nickname])),
    [members],
  );
  const presence = usePresence({
    topic: `chat:${postId}`,
    viewerId: viewer.id,
    canTrack: canSend,
    allowedIds: memberIds,
  });
  const typingLine = formatTyping(presence.typingIds.map((id) => nicknames.get(id) ?? ""));
  const presentLine = formatPresent(presence.presentIds.length);

  function nextLocalId(prefix: string): string {
    localCount.current += 1;
    return `${prefix}-local-${localCount.current}`;
  }

  function quoteOf(message: MessageView | null): ReplyPreview | null {
    if (!message) return null;
    return {
      id: message.id,
      author_nickname: message.author.nickname,
      content: message.content.trim(),
      has_media: message.media_url !== null,
    };
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
      reply_to_id: replyTo?.id ?? null,
      reply_to: quoteOf(replyTo),
      created_at: new Date().toISOString(),
      author: viewer,
      role: rights.role === "guest" ? "participant" : rights.role,
    };
    setMessages((previous) => [...previous, message]);
    return message.id;
  }

  const [, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();

  /** Убрать оптимистичное сообщение, если сервер его не принял. */
  function dropMessage(localId: string) {
    setMessages((previous) => previous.filter((message) => message.id !== localId));
  }

  function handleSend(text: string) {
    const replyId = replyTo?.id ?? null;
    const localId = appendMessage(text, null);
    setReplyTo(null);
    presence.notifyStopped();
    deliver(localId, () => sendMessage(postId, text, null, replyId));
  }

  /**
   * Фото видно в чате сразу — из памяти браузера, пока файл грузится.
   * Не загрузилось или сервер не принял сообщение — сообщение исчезает, а
   * уже загруженный файл удаляется, чтобы не висел сиротой.
   */
  function handleSendMedia(file: File, caption: string) {
    const replyId = replyTo?.id ?? null;
    const preview = URL.createObjectURL(file);
    const localId = appendMessage(caption, "uploading", preview);
    setReplyTo(null);
    presence.notifyStopped();
    deliver(localId, async () => {
      const upload = await uploadChatImage(file, postId);
      if (!upload.ok) return upload;
      const result = await sendMessage(postId, caption, upload.value, replyId);
      if (!result.ok) await discardChatImage(upload.value);
      return result;
    });
  }

  function deliver(
    localId: string,
    run: () => Promise<
      { ok: true; data?: { id: string; created_at: string } } | { ok: false; error: string }
    >,
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

    setMessages((previous) =>
      previous.map((message) => {
        if (message.id === messageId) return { ...message, is_pinned: pin };
        return message.is_pinned ? { ...message, is_pinned: false } : message;
      }),
    );
  }

  /** Удаление подтверждено: сообщение уходит с экрана сразу, ответы теряют цитату. */
  function confirmDelete() {
    const target = deleting;
    if (!target) return;
    const before = messages;
    startDelete(async () => {
      const result = await deleteMessage(postId, target.id);
      if (!result.ok) {
        setMessages(before);
        notify(result.error);
      }
    });
    setDeleting(null);
    if (replyTo?.id === target.id) setReplyTo(null);
    setMessages((previous) =>
      previous
        .filter((message) => message.id !== target.id)
        .map((message) => (message.reply_to_id === target.id ? { ...message, reply_to: null } : message)),
    );
  }

  async function copyText(message: MessageView) {
    try {
      await navigator.clipboard.writeText(message.content);
      notify("Текст скопирован.", "info");
    } catch {
      notify("Не получилось скопировать. Выдели текст вручную.");
    }
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
          tally[poll.viewer_choice] = Math.max(0, (tally[poll.viewer_choice] ?? 0) - 1);
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
    const target = document.getElementById(`msg-${messageId}`);
    if (!target) {
      notify("Это сообщение старше загруженной истории.", "info");
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });

    setFlashId(messageId);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 2000);
  }

  /** «⋯» у сообщения: какие пункты — решает messageActions (lib/rights.ts). */
  function actionsOf(message: MessageView): SheetAction[] {
    return messageActions(message, viewer.id, rights, canSend).map((action): SheetAction => {
      switch (action) {
        case "reply":
          return { label: "Ответить", icon: "reply", onSelect: () => setReplyTo(message) };
        case "copy":
          return { label: "Скопировать текст", icon: "copy", onSelect: () => void copyText(message) };
        case "pin":
          return { label: "Закрепить", icon: "pin", onSelect: () => handleTogglePin(message.id) };
        case "unpin":
          return { label: "Открепить", icon: "pin", onSelect: () => handleTogglePin(message.id) };
        case "delete":
          return {
            label: "Удалить сообщение",
            icon: "trash",
            danger: true,
            onSelect: () => setDeleting(message),
          };
        case "report":
          return { label: "Пожаловаться", icon: "flag", danger: true, onSelect: () => setReporting(message) };
      }
    });
  }

  const empty = messages.length === 0 && polls.length === 0;

  return (
    <section aria-label="Групповой чат">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-2">
        <h2 className="text-[13px] font-medium text-ink-faint">Чат</h2>
        {presentLine ? <p className="text-[13px] text-ink-faint">{presentLine}</p> : null}
      </div>

      {pinned ? (
        <div className="sticky top-14 z-10 flex items-center gap-2 bg-sunken px-3 py-1.5">
          <Icon name="pin" size={15} className="shrink-0 text-ink-faint" />
          <button
            type="button"
            onClick={() => jumpToMessage(pinned.id)}
            className="min-h-10 min-w-0 flex-1 px-1 text-left"
          >
            <span className="block text-[12px] text-ink-soft">Закреплено: {pinned.author.nickname}</span>
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

      {historyLimited ? (
        <p className="px-4 pt-2 text-center text-[13px] text-ink-faint">Показаны последние сообщения чата.</p>
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
          canVote={canSend}
          flashId={flashId}
          onOpenActions={setActionsFor}
          onJump={jumpToMessage}
          onVote={handleVote}
        />
      )}

      {/* Живая строка: экранные читалки сообщают о ней, не перебивая. */}
      <p className="min-h-5 px-4 pb-1 text-[13px] text-ink-soft" role="status" aria-live="polite">
        {typingLine ?? ""}
      </p>

      <Composer
        canSend={canSend}
        canPostMedia={rights.canPostMedia}
        canPoll={rights.canPoll}
        joinBlockedReason={joinBlockedReason}
        replyTo={quoteOf(replyTo)}
        onCancelReply={() => setReplyTo(null)}
        onTyping={presence.notifyTyping}
        onSend={handleSend}
        onSendMedia={handleSendMedia}
        onOpenPoll={() => setPollOpen(true)}
        onJoin={onJoin}
      />

      {rights.canPoll ? (
        <PollComposer open={pollOpen} onClose={() => setPollOpen(false)} onCreate={handleCreatePoll} />
      ) : null}

      <ActionSheet
        open={actionsFor !== null}
        onClose={() => setActionsFor(null)}
        title={actionsFor ? `Сообщение от ${actionsFor.author.nickname}` : "Сообщение"}
        actions={actionsFor ? actionsOf(actionsFor) : []}
      />

      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Удалить сообщение?"
        confirmLabel="Удалить сообщение"
        onConfirm={confirmDelete}
        pending={deletePending}
      >
        <p>
          {deleting && deleting.author_id !== viewer.id
            ? `Ты автор идеи и можешь убрать любое сообщение. Сообщение от ${deleting.author.nickname} исчезнет у всех участников.`
            : "Сообщение исчезнет у всех участников. Вернуть его не получится."}
        </p>
      </ConfirmSheet>

      {reporting ? (
        <ReportSheet
          open
          onClose={() => setReporting(null)}
          targetType="message"
          targetId={reporting.id}
          subject={`от ${reporting.author.nickname}`}
        />
      ) : null}
    </section>
  );
}
