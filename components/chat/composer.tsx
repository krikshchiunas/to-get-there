"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";

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
  onSend: (text: string) => void;
  onSendMedia: (fileName: string) => void;
  onOpenPoll: () => void;
  onJoin: () => void;
}) {
  const [value, setValue] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onSendMedia(file.name);
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
        Сообщение в чат
      </label>

      <div className="flex items-end gap-1.5">
        {canPostMedia ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
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
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение всем"
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
