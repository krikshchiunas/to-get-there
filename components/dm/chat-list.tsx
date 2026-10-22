import { listLead, listTime } from "@/components/ui/list-row";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { Seats } from "@/components/ui/seats";
import { Verified } from "@/components/ui/verified";
import {
  feedExitReason,
  formatDayLabel,
  formatStamp,
  formatTime,
  isInFeed,
  pluralRu,
  urgencyOf,
} from "@/lib/format";
import type { getMyIdeaChats } from "@/lib/data";
import type { ConversationView } from "@/lib/types";

/**
 * The two list renderers behind /messages. Both are plain server
 * components: the chat list never ticks, it is rendered once per request
 * with the `now` the page read from the clock.
 *
 * Обе вкладки — один и тот же список: строка лежит на фоне и отделена снизу
 * линией во всю ширину колонки. Ни рамки, ни второго фона, ни тени: список
 * чатов в Threads и Bluesky выглядит именно так, и от этого он читается
 * быстрее, чем столбик карточек.
 */
export type IdeaChatEntry = Awaited<ReturnType<typeof getMyIdeaChats>>[number];

/* ── idea chats ─────────────────────────────────────────────────── */

export function IdeaChatList({
  chats,
  viewerId,
  now,
}: {
  chats: IdeaChatEntry[];
  viewerId: string;
  now: Date;
}) {
  if (chats.length === 0) {
    return (
      <EmptyState
        icon="chat"
        title="Чатов идей пока нет"
        body="Присоединишься к идее — её чат появится здесь и останется, даже когда идея пройдёт."
        action={<ButtonLink href="/">Смотреть идеи</ButtonLink>}
      />
    );
  }

  return (
    <ul className="u-feed">
      {chats.map((entry) => (
        <IdeaChatRow key={entry.post.id} entry={entry} viewerId={viewerId} now={now} />
      ))}
    </ul>
  );
}

function IdeaChatRow({ entry, viewerId, now }: { entry: IdeaChatEntry; viewerId: string; now: Date }) {
  const { post, last_message, participant_count } = entry;

  // The chat outlives the listing: a closed or finished idea keeps its room.
  const live = isInFeed(post, now);
  const exit = live ? null : feedExitReason(post, now);
  const urgency = urgencyOf(post.date_start, now);
  const pressing = urgency === "now" || urgency === "soon";

  // Цвет на времени только когда событие совсем близко — больше нигде.
  const timeTone = pressing ? "text-heat" : "text-ink";
  // Профиль автора может быть зрителю не виден — тогда строка без имени.
  const speaker =
    last_message === undefined
      ? null
      : last_message.author_id === viewerId
        ? "Ты"
        : last_message.author_nickname;

  return (
    <li className="u-feed-divider">
      <Link href={`/post/${post.id}`} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-sunken">
        <span className={`${listLead} ${listTime} ${timeTone}`}>{formatTime(post.date_start)}</span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{post.title}</span>

          {last_message ? (
            <span className="mt-0.5 block truncate text-[15px] leading-[1.4] text-ink-soft">
              {speaker ? `${speaker}: ` : null}
              {last_message.media_url ? (
                <Icon name="image" size={14} className="mx-0.5 inline align-[-2px]" />
              ) : null}
              {last_message.content.trim() || "Фото"}
            </span>
          ) : (
            <span className="mt-0.5 block text-[15px] leading-[1.4] text-ink-soft">Сообщений пока нет</span>
          )}

          <span className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-soft">
            <span>{formatDayLabel(post.date_start, now)}</span>
            <span aria-hidden>·</span>
            <Seats count={participant_count} max={null} />
            {exit ? (
              <Pill className="ml-0.5">{exit === "closed" ? "Набор закрыт" : "Уже прошла"}</Pill>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

/* ── direct conversations ───────────────────────────────────────── */

export function DirectChatList({
  conversations,
  viewerId,
  now,
}: {
  conversations: ConversationView[];
  viewerId: string;
  now: Date;
}) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon="send"
        title="Личных сообщений пока нет"
        body="Напиши тому, с кем познакомился в чате идеи. Искать можно по нику, факультету или интересу."
        action={<ButtonLink href="/search">Найти людей</ButtonLink>}
      />
    );
  }

  return (
    <ul className="u-feed">
      {conversations.map((conversation) => (
        <DirectChatRow
          key={conversation.partner.id}
          conversation={conversation}
          viewerId={viewerId}
          now={now}
        />
      ))}
    </ul>
  );
}

function DirectChatRow({
  conversation,
  viewerId,
  now,
}: {
  conversation: ConversationView;
  viewerId: string;
  now: Date;
}) {
  const { partner, last_message, unread_count, can_reply } = conversation;
  const fromViewer = last_message.sender_id === viewerId;

  return (
    <li className="u-feed-divider">
      <Link
        href={`/messages/${partner.nickname}`}
        className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-sunken"
      >
        <span className={listLead}>
          <Avatar user={partner} size="md" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-medium">{partner.nickname}</span>
            {partner.is_verified ? <Verified size={13} className="shrink-0" /> : null}
            <span className="u-tnum ml-auto shrink-0 text-[14px] text-ink-soft">
              {formatStamp(last_message.created_at, now)}
            </span>
          </span>

          <span className="mt-0.5 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[15px] leading-[1.4] text-ink-soft">
              {fromViewer ? "Ты: " : null}
              {last_message.media_url ? (
                <Icon name="image" size={14} className="mr-1 inline align-[-2px]" />
              ) : null}
              {last_message.content.trim() || "Фото"}
            </span>

            {unread_count > 0 ? (
              <span className="shrink-0">
                <span aria-hidden className="block size-2 rounded-full bg-signal" />
                <span className="sr-only">
                  {unread_count}{" "}
                  {pluralRu(unread_count, [
                    "непрочитанное сообщение",
                    "непрочитанных сообщения",
                    "непрочитанных сообщений",
                  ])}
                </span>
              </span>
            ) : null}
          </span>

          {can_reply ? null : (
            <span className="mt-1 block text-[14px] text-ink-soft">
              {partner.nickname} не принимает сообщения.
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
