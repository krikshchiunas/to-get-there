"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AvatarLink } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { TimeFromNow } from "@/components/ui/time-from-now";
import { Verified } from "@/components/ui/verified";
import type { ChatRole, MessageView, PollView } from "@/lib/types";
import { PollCard } from "./poll-card";

/** Consecutive messages from one person stay together inside this window. */
const GROUP_WINDOW_MS = 20 * 60 * 1000;

const roleLabels: Partial<Record<ChatRole, string>> = {
  author: "автор",
  moderator: "модератор",
};

/**
 * Who holds which role in the chat. Shared with the participant sheet so the
 * stream and the roster never disagree about what someone is called.
 */
export function RoleMarker({ role }: { role: ChatRole }) {
  const label = roleLabels[role];
  if (!label) return null;

  return <Pill>{label}</Pill>;
}

type Entry =
  | { kind: "message"; at: string; message: MessageView }
  | { kind: "poll"; at: string; poll: PollView };

/**
 * Фото в сообщении. Подписанная ссылка живёт час: если она истекла, пока
 * страница была открыта, картинка не загрузится — тогда страница
 * перечитывается и приходит свежая ссылка.
 */
function ChatImage({
  src,
  uploading,
  alt,
  spaced,
}: {
  src: string | null;
  uploading: boolean;
  alt: string;
  spaced: boolean;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex w-fit items-center gap-2.5 rounded-field bg-sunken px-3 py-2.5 ${spaced ? "mt-1.5" : ""}`}
      >
        <Icon name="image" size={18} className="shrink-0 text-ink-faint" />
        <span className="text-[14px] text-ink-soft">Фото недоступно</span>
      </div>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative block w-fit max-w-[min(100%,20rem)] overflow-hidden rounded-field bg-sunken ${spaced ? "mt-1.5" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка на час, оптимизатору её не кэшировать */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`block h-auto max-h-80 w-full object-cover ${uploading ? "opacity-60" : ""}`}
        onError={() => {
          setFailed(true);
          if (!uploading) router.refresh();
        }}
      />
      {uploading ? (
        <span className="absolute inset-x-0 bottom-0 bg-paper/85 px-2.5 py-1 text-[12px] text-ink-soft" role="status">
          Загружается…
        </span>
      ) : null}
    </a>
  );
}

/** True when this message tucks under the one before it. */
function tucksUnder(previous: Entry | undefined, message: MessageView): boolean {
  if (!previous || previous.kind !== "message") return false;
  if (previous.message.author_id !== message.author_id) return false;
  const gap =
    new Date(message.created_at).getTime() - new Date(previous.message.created_at).getTime();
  return gap < GROUP_WINDOW_MS;
}

/**
 * Групповой чат, а не переписка на двоих.
 *
 * Здесь десяток человек договаривается об одном выходе, поэтому сообщения
 * лежат одной читаемой колонкой: аватар слева — якорь, текст без пузыря.
 * Своё сообщение отличается лёгкой заливкой на самом тексте, а не прыжком
 * в правый ряд: в групповом чате правый ряд ломает порядок чтения.
 */
export function MessageList({
  messages,
  polls,
  viewerId,
  canPin,
  canVote,
  flashId,
  onTogglePin,
  onVote,
}: {
  messages: MessageView[];
  polls: PollView[];
  viewerId: string;
  canPin: boolean;
  canVote: boolean;
  /** Message briefly highlighted after a jump from the pinned bar. */
  flashId: string | null;
  onTogglePin: (messageId: string) => void;
  onVote: (pollId: string, optionIndex: number) => void;
}) {
  const entries: Entry[] = [
    ...messages.map<Entry>((message) => ({
      kind: "message",
      at: message.created_at,
      message,
    })),
    ...polls.map<Entry>((poll) => ({ kind: "poll", at: poll.created_at, poll })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <ul className="py-2">
      {entries.map((entry, index) => {
        if (entry.kind === "poll") {
          return (
            <li key={entry.poll.id} className="flex gap-3 px-4 py-2">
              <div className="w-8 shrink-0">
                <AvatarLink user={entry.poll.author} size="sm" />
              </div>
              <div className="min-w-0 flex-1">
                <PollCard
                  poll={entry.poll}
                  canVote={canVote}
                  onVote={(optionIndex) => onVote(entry.poll.id, optionIndex)}
                />
              </div>
            </li>
          );
        }

        const message = entry.message;
        const tucked = tucksUnder(entries[index - 1], message);
        const own = message.author_id === viewerId;
        const text = message.content.trim();

        return (
          <li
            key={message.id}
            id={`msg-${message.id}`}
            className={`flex scroll-mt-28 gap-3 px-4 py-2 ${
              flashId === message.id ? "bg-sunken" : ""
            }`}
          >
            {/* Аватар только у первого сообщения из подряд идущих. */}
            <div className="w-8 shrink-0">
              {tucked ? null : <AvatarLink user={message.author} size="sm" />}
            </div>

            <div className="min-w-0 flex-1">
              {tucked ? null : (
                <div className="mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <Link
                    href={`/u/${message.author.nickname}`}
                    className="text-[14px] font-medium hover:underline"
                  >
                    {message.author.nickname}
                  </Link>
                  {message.author.is_verified ? <Verified size={13} /> : null}
                  <RoleMarker role={message.role} />
                  <TimeFromNow
                    value={message.created_at}
                    mode="stamp"
                    className="u-tnum text-[12px] text-ink-faint"
                  />
                </div>
              )}

              {text ? (
                <p
                  className={`text-[15px] leading-[1.45] whitespace-pre-line text-ink ${
                    own ? "w-fit rounded-2xl bg-signal-wash px-3.5 py-2" : ""
                  }`}
                >
                  {text}
                </p>
              ) : null}

              {message.media_url ? (
                <ChatImage
                  src={message.media_src ?? null}
                  uploading={message.media_url === "uploading"}
                  alt={`Фото от ${message.author.nickname}`}
                  spaced={Boolean(text)}
                />
              ) : null}
            </div>

            {canPin ? (
              <div className="shrink-0">
                <IconButton
                  type="button"
                  variant="ghost"
                  label={
                    message.is_pinned
                      ? "Открепить"
                      : `Закрепить сообщение от ${message.author.nickname}`
                  }
                  onClick={() => onTogglePin(message.id)}
                  className={message.is_pinned ? "text-signal" : ""}
                >
                  <Icon name="pin" size={17} />
                </IconButton>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
