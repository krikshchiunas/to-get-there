"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ReplyPreview } from "@/lib/types";

const MAX_COMPOSER_HEIGHT = 160;
const MAX_MESSAGE = 2000;

/** Поле лички: растёт с текстом, Enter отправляет, Esc снимает ответ. */
export function DmComposer({
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

