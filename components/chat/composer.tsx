"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import type { ReplyPreview } from "@/lib/types";

const MAX_HEIGHT = 168;

/** Поле композера — заливка со скруглением 16px, без рамки. */
const FIELD_RADIUS = 16;

/**
 * The composer only shows what the viewer is allowed to do: a participant
 * sees text and send, media and polls appear with the matching right. A guest
 * who may enter but has not joined gets the join action instead.
 *
 * Одна строка: вспомогательные действия слева, поле посередине, круглая
 * кнопка отправки справа — как в чатах, с которых это снято.
 */
export function Composer({
  canSend,
  canPostMedia,
  canPoll,
  joinBlockedReason,
  replyTo = null,
  onCancelReply,
  onTyping,
  onSend,
  onSendMedia,
  onOpenPoll,
  onJoin,
}: {
  canSend: boolean;
  canPostMedia: boolean;
  canPoll: boolean;
  /** Set when joining is not possible any more — then only reading is left. */
  joinBlockedReason: string | null;
  /** Ответ на это сообщение — полоска над полем, крестик отменяет. */
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  /** Каждый ввод — для «печатает…» у остальных. */
  onTyping?: () => void;
  onSend: (text: string) => void;
  /** Фото и, если в поле что-то написано, подпись к нему. */
  onSendMedia: (file: File, caption: string) => void;
  onOpenPoll: () => void;
  onJoin: () => void;
}) {
  const [value, setValue] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Выбрали «Ответить» — курсор сразу в поле, как в мессенджерах. На
  // следующем кадре: закрываясь, лист действий возвращает фокус на «⋯».
  useEffect(() => {
    if (!replyTo) return;
    const frame = requestAnimationFrame(() => wrapRef.current?.querySelector("textarea")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [replyTo]);

  // The textarea grows with the text and stops at six lines or so.
  useEffect(() => {
    const field = wrapRef.current?.querySelector("textarea");
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_HEIGHT)}px`;
  }, [value, canSend]);

  function submit() {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && replyTo) {
      event.preventDefault();
      onCancelReply?.();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onSendMedia(file, value.trim());
    setValue("");
  }

  if (!canSend) {
    return (
      <div className="border-t border-line px-4 py-4">
        {joinBlockedReason ? (
          <p className="flex items-start gap-2 text-[14px] leading-[1.5] text-ink-soft">
            <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-ink-faint" />
            {joinBlockedReason}
          </p>
        ) : (
          <>
            <Button type="button" size="lg" full onClick={onJoin}>
              Присоединиться
            </Button>
            <p className="mt-2 text-center text-[14px] text-ink-soft">
              После этого сможешь писать в чат.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-line px-3 py-2.5">
      <label htmlFor="chat-composer" className="sr-only">
        {replyTo ? `Ответ для ${replyTo.author_nickname}` : "Сообщение в чат"}
      </label>

      {replyTo ? (
        <div className="mb-2 flex items-center gap-2 pl-1">
          <Icon name="reply" size={16} className="shrink-0 text-signal" />
          <div className="min-w-0 flex-1 border-l-2 border-signal/60 pl-2.5">
            <p className="text-[13px] font-medium text-ink-soft">Ответ {replyTo.author_nickname}</p>
            <p className="truncate text-[13px] text-ink-soft">
              {replyTo.content || (replyTo.has_media ? "Фото" : "Сообщение")}
            </p>
          </div>
          <IconButton type="button" variant="ghost" label="Отменить ответ" onClick={onCancelReply}>
            <Icon name="close" size={16} />
          </IconButton>
        </div>
      ) : null}

      <div className="flex items-end gap-1.5">
        {canPostMedia ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="hidden"
              onChange={handleFile}
            />
            <IconButton
              type="button"
              variant="ghost"
              label="Прикрепить изображение"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="image" size={19} />
            </IconButton>
          </>
        ) : null}

        {canPoll ? (
          <IconButton
            type="button"
            variant="ghost"
            label="Создать голосование"
            onClick={onOpenPoll}
          >
            <Icon name="poll" size={19} />
          </IconButton>
        ) : null}

        <div ref={wrapRef} className="min-w-0 flex-1">
          <TextArea
            id="chat-composer"
            rows={1}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (event.target.value.trim()) onTyping?.();
            }}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            placeholder={replyTo ? "Твой ответ" : "Сообщение всем"}
            style={{ resize: "none", maxHeight: MAX_HEIGHT, borderRadius: FIELD_RADIUS }}
          />
        </div>

        <IconButton type="submit" label="Отправить" variant="primary" disabled={!value.trim()}>
          <Icon name="send" size={18} />
        </IconButton>
      </div>

      <p className="mt-1.5 hidden pl-1 text-[12px] text-ink-faint sm:block">
        Enter отправляет, Shift с Enter переносит строку
      </p>
    </form>
  );
}
