"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { deleteDirectMessage, markConversationRead, sendDirectMessage } from "@/app/actions/dm";
import { notify } from "@/components/ui/toast";
import { ActionSheet, ConfirmSheet, type SheetAction } from "@/components/ui/action-sheet";
import { EmptyState } from "@/components/ui/empty";
import { ReportSheet } from "@/components/safety/report-sheet";
import { dayKey, formatDayLabel } from "@/lib/format";
import type { DirectMessage, ReplyPreview, UserView } from "@/lib/types";
import { dmTopic, usePresence } from "@/lib/use-presence";
import { Bubble } from "./bubble";
import { ClosedComposer } from "./closed-composer";
import { DmComposer } from "./dm-composer";

/**
 * One direct conversation. Two sides, so the thread reads as bubbles: the
 * viewer right on `signal`, the partner left on `sunken`. `now` arrives from
 * the page so the day dividers cannot drift between the server render and
 * hydration — the stamps inside the bubbles tick with <TimeFromNow>.
 *
 * Пузырь — единственное место в приложении, где скругление осмысленно: оно
 * показывает границу реплики. Поэтому всё остальное здесь максимально тихое:
 * день — просто текст по центру без линий и плашки, время — под пузырём, а не
 * внутри, у композера нет ни рамки, ни тени.
 *
 * Как в мессенджерах: ответить на реплику, удалить своё у обоих,
 * пожаловаться на чужое; «печатает…» и «в чате» — по каналу dm:<a>:<b>
 * (0033), «Прочитано» — по отметке собеседника (0032), если оба её не
 * выключили.
 */

type DayGroup = { key: string; label: string; items: DirectMessage[] };

export function Conversation({
  partner,
  viewerId,
  messages,
  canReply,
  partnerReadAt,
  now,
}: {
  partner: UserView;
  viewerId: string;
  messages: DirectMessage[];
  canReply: boolean;
  /** Когда собеседник последний раз открывал переписку; null — не показывать. */
  partnerReadAt: string | null;
  now: Date;
}) {
  const [appended, setAppended] = useState<DirectMessage[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [actionsFor, setActionsFor] = useState<DirectMessage | null>(null);
  const [deleting, setDeleting] = useState<DirectMessage | null>(null);
  const [reporting, setReporting] = useState<DirectMessage | null>(null);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // После отправки сервер присылает то же сообщение повторно (revalidate):
  // локальная копия к этому моменту уже несёт настоящий id и уступает ему.
  const thread = useMemo(() => {
    const known = new Set(messages.map((message) => message.id));
    return [...messages, ...appended.filter((message) => !known.has(message.id))].filter(
      (message) => !removed.has(message.id),
    );
  }, [messages, appended, removed]);

  const byId = useMemo(() => new Map(thread.map((message) => [message.id, message])), [thread]);

  const groups = useMemo(() => {
    const out: DayGroup[] = [];
    for (const message of thread) {
      const key = dayKey(message.created_at);
      const open = out[out.length - 1];
      if (open && open.key === key) {
        open.items.push(message);
      } else {
        out.push({ key, label: formatDayLabel(message.created_at, now), items: [message] });
      }
    }
    return out;
  }, [thread, now]);

  /**
   * The newest message on arrival, and again after every send. The column
   * itself scrolls, and the layout keeps a bottom gutter for the nav bar, so
   * the end of the document is exactly the end of the thread.
   */
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [thread.length]);

  const [, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();

  // Открыл переписку — всё присланное собеседником прочитано. И снова,
  // когда новое сообщение от него пришло, пока переписка открыта.
  const lastFromPartner = [...messages].reverse().find((message) => message.sender_id === partner.id)?.id;
  useEffect(() => {
    void markConversationRead(partner.id);
  }, [partner.id, lastFromPartner]);

  const partnerIds = useMemo(() => new Set([partner.id]), [partner.id]);
  const presence = usePresence({
    topic: canReply || thread.length > 0 ? dmTopic(viewerId, partner.id) : null,
    viewerId,
    canTrack: true,
    allowedIds: partnerIds,
  });
  const partnerTyping = presence.typingIds.includes(partner.id);
  const partnerHere = presence.presentIds.includes(partner.id);

  /** Последнее своё сообщение, которое собеседник уже видел. */
  const lastReadOwnId = useMemo(() => {
    if (!partnerReadAt) return null;
    const own = thread.filter(
      (message) =>
        message.sender_id === viewerId &&
        !message.id.startsWith("local-") &&
        message.created_at <= partnerReadAt,
    );
    return own[own.length - 1]?.id ?? null;
  }, [thread, partnerReadAt, viewerId]);
  const lastOwnId = [...thread].reverse().find((message) => message.sender_id === viewerId)?.id ?? null;

  function quoteOf(message: DirectMessage | null | undefined): ReplyPreview | null {
    if (!message) return null;
    return {
      id: message.id,
      author_nickname: message.sender_id === viewerId ? "ты" : partner.nickname,
      content: message.content.trim(),
      has_media: message.media_url !== null,
    };
  }

  function handleSend(content: string) {
    const localId = `local-${Date.now()}`;
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);
    presence.notifyStopped();
    startTransition(async () => {
      const result = await sendDirectMessage(partner.id, content, replyId);
      if (!result.ok) {
        setAppended((previous) => previous.filter((message) => message.id !== localId));
        notify(result.error);
        return;
      }
      const real = result.data;
      if (real) {
        setAppended((previous) =>
          previous.some((message) => message.id === real.id)
            ? previous.filter((message) => message.id !== localId)
            : previous.map((message) =>
                message.id === localId ? { ...message, id: real.id, created_at: real.created_at } : message,
              ),
        );
      }
    });
    setAppended((previous) => [
      ...previous,
      {
        id: localId,
        sender_id: viewerId,
        receiver_id: partner.id,
        content,
        media_url: null,
        reply_to_id: replyId,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  function confirmDelete() {
    const target = deleting;
    if (!target) return;
    setDeleting(null);
    if (replyTo?.id === target.id) setReplyTo(null);
    setRemoved((previous) => new Set(previous).add(target.id));
    startDelete(async () => {
      const result = await deleteDirectMessage(target.id);
      if (!result.ok) {
        setRemoved((previous) => {
          const next = new Set(previous);
          next.delete(target.id);
          return next;
        });
        notify(result.error);
      }
    });
  }

  async function copyText(message: DirectMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      notify("Текст скопирован.", "info");
    } catch {
      notify("Не получилось скопировать. Выдели текст вручную.");
    }
  }

  function jumpTo(messageId: string) {
    const target = document.getElementById(`dm-${messageId}`);
    if (!target) {
      notify("Это сообщение старше загруженной истории.", "info");
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    setFlashId(messageId);
    window.setTimeout(() => setFlashId((current) => (current === messageId ? null : current)), 2000);
  }

  function actionsOf(message: DirectMessage): SheetAction[] {
    const mine = message.sender_id === viewerId;
    const list: SheetAction[] = [];
    if (canReply) list.push({ label: "Ответить", icon: "reply", onSelect: () => setReplyTo(message) });
    if (message.content.trim())
      list.push({ label: "Скопировать текст", icon: "copy", onSelect: () => void copyText(message) });
    if (mine)
      list.push({
        label: "Удалить у обоих",
        icon: "trash",
        danger: true,
        onSelect: () => setDeleting(message),
      });
    else
      list.push({ label: "Пожаловаться", icon: "flag", danger: true, onSelect: () => setReporting(message) });
    return list;
  }

  return (
    <div className="flex flex-col">
      <p className="sr-only" role="status" aria-live="polite">
        {partnerTyping ? `${partner.nickname} печатает` : ""}
      </p>

      {thread.length === 0 ? (
        <EmptyState
          icon="send"
          title="Сообщений пока нет"
          body={
            canReply
              ? `Напиши ${partner.nickname} первое сообщение.`
              : `Вы с ${partner.nickname} пока не переписывались.`
          }
        />
      ) : (
        <div role="log" aria-label={`Сообщения с ${partner.nickname}`} className="px-4 pb-2">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="py-4 text-center text-[13px] font-medium text-ink-faint">{group.label}</h2>

              <ol className="flex flex-col gap-2">
                {group.items.map((message) => (
                  <Bubble
                    key={message.id}
                    message={message}
                    mine={message.sender_id === viewerId}
                    reply={message.reply_to_id ? quoteOf(byId.get(message.reply_to_id)) : undefined}
                    read={message.id === lastReadOwnId && message.id === lastOwnId}
                    flashed={flashId === message.id}
                    onJump={jumpTo}
                    onOpenActions={() => setActionsFor(message)}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <p className="min-h-5 px-4 pb-1 text-[13px] text-ink-soft" aria-hidden>
        {partnerTyping
          ? `${partner.nickname} печатает…`
          : partnerHere
            ? `${partner.nickname} сейчас в чате`
            : ""}
      </p>

      {canReply ? (
        <DmComposer
          partnerNickname={partner.nickname}
          replyTo={quoteOf(replyTo)}
          onCancelReply={() => setReplyTo(null)}
          onTyping={presence.notifyTyping}
          onSend={handleSend}
        />
      ) : (
        <ClosedComposer partner={partner} viewerId={viewerId} />
      )}

      <ActionSheet
        open={actionsFor !== null}
        onClose={() => setActionsFor(null)}
        title="Сообщение"
        actions={actionsFor ? actionsOf(actionsFor) : []}
      />

      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Удалить сообщение?"
        confirmLabel="Удалить у обоих"
        onConfirm={confirmDelete}
        pending={deletePending}
      >
        <p>Сообщение исчезнет и у тебя, и у {partner.nickname}. Вернуть его не получится.</p>
      </ConfirmSheet>

      {reporting ? (
        <ReportSheet
          open
          onClose={() => setReporting(null)}
          targetType="direct_message"
          targetId={reporting.id}
          subject={`от ${partner.nickname}`}
        />
      ) : null}
    </div>
  );
}
