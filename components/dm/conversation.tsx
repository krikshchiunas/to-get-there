"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteDirectMessage, markConversationRead, sendDirectMessage } from "@/app/actions/dm";
import { setBlocked } from "@/app/actions/safety";
import { notify } from "@/components/ui/toast";
import { ActionSheet, ConfirmSheet, type SheetAction } from "@/components/ui/action-sheet";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { TimeFromNow } from "@/components/ui/time-from-now";
import { ReportSheet } from "@/components/safety/report-sheet";
import { ReplyQuote } from "@/components/chat/message-list";
import { dayKey, formatDayLabel } from "@/lib/format";
import type { DirectMessage, ReplyPreview, UserView } from "@/lib/types";
import { dmTopic, usePresence } from "@/lib/use-presence";

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
const MAX_COMPOSER_HEIGHT = 160;
const MAX_MESSAGE = 2000;

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
      (message) => message.sender_id === viewerId && !message.id.startsWith("local-") && message.created_at <= partnerReadAt,
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
    if (message.content.trim()) list.push({ label: "Скопировать текст", icon: "copy", onSelect: () => void copyText(message) });
    if (mine) list.push({ label: "Удалить у обоих", icon: "trash", danger: true, onSelect: () => setDeleting(message) });
    else list.push({ label: "Пожаловаться", icon: "flag", danger: true, onSelect: () => setReporting(message) });
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
        <div
          role="log"
          aria-label={`Сообщения с ${partner.nickname}`}
          className="px-4 pb-2"
        >
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
        {partnerTyping ? `${partner.nickname} печатает…` : partnerHere ? `${partner.nickname} сейчас в чате` : ""}
      </p>

      {canReply ? (
        <Composer
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

/* ── bubbles ────────────────────────────────────────────────────── */

function Bubble({
  message,
  mine,
  reply,
  read,
  flashed,
  onJump,
  onOpenActions,
}: {
  message: DirectMessage;
  mine: boolean;
  /** undefined — не ответ; null — ответ на удалённое или незагруженное. */
  reply: ReplyPreview | null | undefined;
  read: boolean;
  flashed: boolean;
  onJump: (messageId: string) => void;
  onOpenActions: () => void;
}) {
  const text = message.content.trim();
  const pending = message.id.startsWith("local-");

  return (
    <li
      id={`dm-${message.id}`}
      className={`group flex scroll-mt-28 flex-col rounded-2xl transition-colors ${mine ? "items-end" : "items-start"} ${
        flashed ? "bg-sunken" : ""
      }`}
    >
      <div className={`flex max-w-full items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
        <div
          className={[
            "max-w-[78vw] min-w-0 rounded-2xl px-3.5 py-2 sm:max-w-[26rem]",
            mine ? "bg-signal text-signal-ink" : "bg-sunken text-ink",
            pending ? "opacity-70" : "",
          ].join(" ")}
        >
          {reply !== undefined ? (
            <ReplyQuote reply={reply} onJump={reply ? onJump : undefined} tone={mine ? "inverse" : "default"} />
          ) : null}

          {message.media_url ? (
            <div
              className={[
                "mb-2 flex h-32 w-56 max-w-full flex-col items-center justify-center gap-1.5 rounded-field text-[13px]",
                mine ? "bg-signal-ink/15 text-signal-ink/85" : "bg-paper text-ink-soft",
              ].join(" ")}
            >
              <Icon name="image" size={20} />
              Фото пока не загружается
            </div>
          ) : null}

          {text ? <p className="text-[15px] leading-[1.4] whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</p> : null}
        </div>

        {pending ? null : (
          <span className="shrink-0 pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
            <IconButton
              type="button"
              variant="ghost"
              label={mine ? "Действия с твоим сообщением" : "Действия с сообщением"}
              aria-haspopup="dialog"
              onClick={onOpenActions}
              className="text-ink-faint"
            >
              <Icon name="more" size={16} />
            </IconButton>
          </span>
        )}
      </div>

      <span className="u-tnum mt-1 px-1 text-[12px] text-ink-faint">
        {pending ? "Отправляется…" : <TimeFromNow value={message.created_at} mode="stamp" />}
        {read ? <span> · Прочитано</span> : null}
      </span>
    </li>
  );
}

/* ── composer ───────────────────────────────────────────────────── */

function Composer({
  partnerNickname,
  replyTo,
  onCancelReply,
  onTyping,
  onSend,
}: {
  partnerNickname: string;
  replyTo: ReplyPreview | null;
  onCancelReply: () => void;
  onTyping: () => void;
  onSend: (content: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text instead of scrolling inside a two-line box.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }, [draft]);

  // На следующем кадре: закрываясь, лист действий возвращает фокус на «⋯».
  useEffect(() => {
    if (!replyTo) return;
    const frame = requestAnimationFrame(() => fieldRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [replyTo]);

  function submit() {
    const content = draft.trim();
    if (!content) return;
    onSend(content);
    setDraft("");
    fieldRef.current?.focus();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="border-t border-line bg-paper px-4 py-3"
    >
      {replyTo ? (
        <div className="mb-2 flex items-center gap-2">
          <Icon name="reply" size={16} className="shrink-0 text-signal" />
          <div className="min-w-0 flex-1 border-l-2 border-signal/60 pl-2.5">
            <p className="text-[13px] font-medium text-ink-soft">
              {replyTo.author_nickname === "ты" ? "Ответ на своё сообщение" : `Ответ ${replyTo.author_nickname}`}
            </p>
            <p className="truncate text-[13px] text-ink-soft">{replyTo.content || "Сообщение"}</p>
          </div>
          <IconButton type="button" variant="ghost" label="Отменить ответ" onClick={onCancelReply}>
            <Icon name="close" size={16} />
          </IconButton>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <label htmlFor="dm-composer" className="sr-only">
          Сообщение для {partnerNickname}
        </label>
        <textarea
          id="dm-composer"
          ref={fieldRef}
          rows={1}
          value={draft}
          maxLength={MAX_MESSAGE}
          onChange={(event) => {
            setDraft(event.target.value);
            if (event.target.value.trim()) onTyping();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && replyTo) {
              event.preventDefault();
              onCancelReply();
              return;
            }
            if (event.key !== "Enter" || event.shiftKey) return;
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            submit();
          }}
          placeholder="Напиши сообщение"
          className="min-h-10 flex-1 resize-none rounded-pill bg-sunken px-4 py-2.5 text-[15px] leading-[1.4] outline-none transition-shadow focus:ring-2 focus:ring-signal/35"
        />
        <IconButton
          type="submit"
          label="Отправить"
          variant="primary"
          disabled={draft.trim().length === 0}
        >
          <Icon name="send" size={19} />
        </IconButton>
      </div>
      <p className="mt-2 hidden text-[13px] text-ink-faint sm:block">
        Enter отправляет, Shift и Enter переносят строку.
      </p>
    </form>
  );
}

/**
 * A composer that cannot work is worse than none: the recipient's setting is
 * spelled out instead, and the profile stays one tap away. Если писать нельзя
 * из-за своей же блокировки — тут же и разблокировать.
 */
function ClosedComposer({ partner, viewerId }: { partner: UserView; viewerId: string }) {
  const notice = noticeFor(partner, viewerId);
  const [pending, startTransition] = useTransition();

  function unblock() {
    startTransition(async () => {
      const result = await setBlocked(partner.id, false);
      if (!result.ok) notify(result.error);
    });
  }

  return (
    <div className="px-4 py-4">
      <div className="rounded-field bg-sunken p-4">
        <p className="flex items-center gap-2 text-[15px]">
          <Icon name={partner.viewer_blocked ? "block" : "lock"} size={17} className="shrink-0 text-ink-soft" />
          {notice.title}
        </p>
        <p className="mt-1 text-[14px] leading-[1.4] text-ink-soft">{notice.body}</p>
        {partner.viewer_blocked ? (
          <Button type="button" variant="quiet" size="md" className="mt-3" onClick={unblock} disabled={pending}>
            Разблокировать
          </Button>
        ) : (
          <Link
            href={`/u/${partner.nickname}`}
            className="mt-1.5 -mx-1 inline-block px-1 py-2 text-[15px] text-signal"
          >
            Открыть профиль
          </Link>
        )}
      </div>
    </div>
  );
}

function noticeFor(partner: UserView, viewerId: string): { title: string; body: string } {
  if (partner.id === viewerId) {
    return {
      title: "Это твой профиль",
      body: "Себе написать нельзя.",
    };
  }

  if (partner.viewer_blocked) {
    return {
      title: `Ты заблокировал ${partner.nickname}`,
      body: "Пока блокировка стоит, вы не можете писать друг другу. История переписки остаётся у тебя.",
    };
  }

  if (partner.privacy_settings.who_can_message === "friends") {
    return {
      title: "Писать могут только друзья",
      body: `${partner.nickname} принимает сообщения только от друзей. Друзьями вы станете, когда подпишетесь друг на друга.`,
    };
  }

  return {
    title: "Сообщения выключены",
    body: `${partner.nickname} не принимает сообщения. Написать можно в чате общей идеи.`,
  };
}
