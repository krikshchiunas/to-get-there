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
import type { ChatRole, MessageView, PollView, ReplyPreview } from "@/lib/types";
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

/**
 * Цитата над ответом: кому и что. Нажатие ведёт к исходному, если оно есть
 * в загруженной истории; удалённое исходное — просто серая строка.
 */
export function ReplyQuote({
  reply,
  onJump,
  tone = "default",
}: {
  reply: ReplyPreview | null | undefined;
  onJump?: (messageId: string) => void;
  /** На заливке своего пузыря в личке — светлая линия. */
  tone?: "default" | "inverse";
}) {
  const line = tone === "inverse" ? "border-signal-ink/50" : "border-signal/60";
  const meta = tone === "inverse" ? "text-signal-ink/80" : "text-ink-soft";

  if (!reply) {
    return (
      <p className={`mb-1 border-l-2 pl-2.5 text-[13px] italic ${line} ${meta}`}>Исходное сообщение удалено</p>
    );
  }

  const preview = reply.content || (reply.has_media ? "Фото" : "Сообщение");
  const body = (
    <>
      <span className={`block text-[13px] font-medium ${meta}`}>{reply.author_nickname}</span>
      <span className={`block truncate text-[13px] ${meta}`}>{preview}</span>
    </>
  );

  return onJump ? (
    <button
      type="button"
      onClick={() => onJump(reply.id)}
      className={`mb-1 block w-full max-w-full min-w-0 border-l-2 pl-2.5 text-left ${line}`}
    >
      <span className="sr-only">Ответ на сообщение. Перейти к нему: </span>
      {body}
    </button>
  ) : (
    <div className={`mb-1 min-w-0 border-l-2 pl-2.5 ${line}`}>{body}</div>
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
 *
 * Действия с сообщением — за «⋯» справа: на телефоне кнопка видна всегда
 * (наведения там нет), с мышью — при наведении и фокусе, чтобы колонка не
 * рябила иконками.
 */
export function MessageList({
  messages,
  polls,
  viewerId,
  canVote,
  flashId,
  onOpenActions,
  onJump,
  onVote,
}: {
  messages: MessageView[];
  polls: PollView[];
  viewerId: string;
  canVote: boolean;
  /** Message briefly highlighted after a jump from the pinned bar or a reply. */
  flashId: string | null;
  /** «⋯» у сообщения: ответить, скопировать, закрепить, удалить, пожаловаться. */
  onOpenActions: (message: MessageView) => void;
  onJump: (messageId: string) => void;
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
        // Ответ всегда со своей шапкой: цитата без ника читается как чужая реплика.
        const tucked = tucksUnder(entries[index - 1], message) && !message.reply_to_id;
        const own = message.author_id === viewerId;
        const text = message.content.trim();
        // Ещё не принято сервером — действовать с ним нечем.
        const pending = message.id.includes("-local-");

        return (
          <li
            key={message.id}
            id={`msg-${message.id}`}
            className={`group flex scroll-mt-28 gap-3 px-4 py-2 transition-colors ${
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
                  {message.is_pinned ? (
                    <span className="inline-flex items-center gap-1 text-[12px] text-ink-faint">
                      <Icon name="pin" size={12} />
                      закреплено
                    </span>
                  ) : null}
                  <TimeFromNow
                    value={message.created_at}
                    mode="stamp"
                    className="u-tnum text-[12px] text-ink-faint"
                  />
                </div>
              )}

              {message.reply_to_id ? (
                <ReplyQuote reply={message.reply_to} onJump={message.reply_to ? onJump : undefined} />
              ) : null}

              {text ? (
                <p
                  className={`text-[15px] leading-[1.45] whitespace-pre-line text-ink [overflow-wrap:anywhere] ${
                    own ? "w-fit max-w-full rounded-2xl bg-signal-wash px-3.5 py-2" : ""
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

            {pending ? null : (
              <div className="shrink-0 pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
                <IconButton
                  type="button"
                  variant="ghost"
                  label={`Действия с сообщением от ${message.author.nickname}`}
                  aria-haspopup="dialog"
                  onClick={() => onOpenActions(message)}
                  className="text-ink-faint"
                >
                  <Icon name="more" size={17} />
                </IconButton>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
