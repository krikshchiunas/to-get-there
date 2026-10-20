"use client";

import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TimeFromNow } from "@/components/ui/time-from-now";
import { ReplyQuote } from "@/components/chat/message-list";
import type { DirectMessage, ReplyPreview } from "@/lib/types";

/** Одна реплика лички: пузырь, цитата ответа, время и «Прочитано». */
export function Bubble({
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
            <ReplyQuote
              reply={reply}
              onJump={reply ? onJump : undefined}
              tone={mine ? "inverse" : "default"}
            />
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

          {text ? (
            <p className="text-[15px] leading-[1.4] whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</p>
          ) : null}
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
