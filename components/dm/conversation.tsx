"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { markConversationRead, sendDirectMessage } from "@/app/actions/dm";
import { notify } from "@/components/ui/toast";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { TimeFromNow } from "@/components/ui/time-from-now";
import { dayKey, formatDayLabel } from "@/lib/format";
import type { DirectMessage, UserView } from "@/lib/types";

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
 */
const MAX_COMPOSER_HEIGHT = 160;

type DayGroup = { key: string; label: string; items: DirectMessage[] };

export function Conversation({
  partner,
  viewerId,
  messages,
  canReply,
  now,
}: {
  partner: UserView;
  viewerId: string;
  messages: DirectMessage[];
  canReply: boolean;
  now: Date;
}) {
  const [appended, setAppended] = useState<DirectMessage[]>([]);

  // После отправки сервер присылает то же сообщение повторно (revalidate):
  // локальная копия к этому моменту уже несёт настоящий id и уступает ему.
  const thread = useMemo(() => {
    const known = new Set(messages.map((message) => message.id));
    return [...messages, ...appended.filter((message) => !known.has(message.id))];
  }, [messages, appended]);

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
  }, [thread]);

  const [, startTransition] = useTransition();

  // Открыл переписку — всё присланное собеседником прочитано. И снова,
  // когда новое сообщение от него пришло, пока переписка открыта.
  const lastFromPartner = [...messages].reverse().find((message) => message.sender_id === partner.id)?.id;
  useEffect(() => {
    void markConversationRead(partner.id);
  }, [partner.id, lastFromPartner]);

  function handleSend(content: string) {
    const localId = `local-${Date.now()}`;
    startTransition(async () => {
      const result = await sendDirectMessage(partner.id, content);
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
        created_at: new Date().toISOString(),
      },
    ]);
  }

  return (
    <div className="flex flex-col">
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
          className="px-4 pb-4"
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
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {canReply ? (
        <Composer partnerNickname={partner.nickname} onSend={handleSend} />
      ) : (
        <ClosedComposer partner={partner} viewerId={viewerId} />
      )}
    </div>
  );
}

/* ── bubbles ────────────────────────────────────────────────────── */

function Bubble({ message, mine }: { message: DirectMessage; mine: boolean }) {
  const text = message.content.trim();

  return (
    <li className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={[
          "max-w-[78%] rounded-2xl px-3.5 py-2",
          mine ? "bg-signal text-signal-ink" : "bg-sunken text-ink",
        ].join(" ")}
      >
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

        {text ? <p className="text-[15px] leading-[1.4] whitespace-pre-wrap">{text}</p> : null}
      </div>

      <span className="u-tnum mt-1 px-1 text-[12px] text-ink-faint">
        <TimeFromNow value={message.created_at} mode="stamp" />
      </span>
    </li>
  );
}

/* ── composer ───────────────────────────────────────────────────── */

function Composer({
  partnerNickname,
  onSend,
}: {
  partnerNickname: string;
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
      <div className="flex items-end gap-2">
        <label htmlFor="dm-composer" className="sr-only">
          Сообщение для {partnerNickname}
        </label>
        <textarea
          id="dm-composer"
          ref={fieldRef}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
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
      <p className="mt-2 text-[13px] text-ink-faint">
        Enter отправляет, Shift и Enter переносят строку.
      </p>
    </form>
  );
}

/**
 * A composer that cannot work is worse than none: the recipient's setting is
 * spelled out instead, and the profile stays one tap away.
 */
function ClosedComposer({ partner, viewerId }: { partner: UserView; viewerId: string }) {
  const notice = noticeFor(partner, viewerId);

  return (
    <div className="px-4 py-4">
      <div className="rounded-field bg-sunken p-4">
        <p className="flex items-center gap-2 text-[15px]">
          <Icon name="lock" size={17} className="shrink-0 text-ink-soft" />
          {notice.title}
        </p>
        <p className="mt-1 text-[14px] leading-[1.4] text-ink-soft">{notice.body}</p>
        <Link
          href={`/u/${partner.nickname}`}
          className="mt-1.5 -mx-1 inline-block px-1 py-2 text-[15px] text-signal"
        >
          Открыть профиль
        </Link>
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
