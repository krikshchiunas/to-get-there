"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { AREA_RADIUS_M } from "@/lib/place";
import { useLiveRefresh } from "@/lib/live";

// Leaflet — только в браузере и только там, где карта нужна.
const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-48 rounded-field bg-sunken" aria-hidden />,
});
import { useSyncedState } from "@/lib/use-synced-state";
import { closePost, joinPost, removeParticipant } from "@/app/actions/posts";
import { setModerator, updateModeratorPermissions } from "@/app/actions/moderation";
import { notify } from "@/components/ui/toast";
import type { ReactNode } from "react";
import { AvatarLink, AvatarStack } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Seats } from "@/components/ui/seats";
import { TimeFromNow } from "@/components/ui/time-from-now";
import { Verified } from "@/components/ui/verified";
import {
  feedExitReason,
  formatDayLong,
  formatParticipants,
  formatRadius,
  formatTime,
  isFull,
  urgencyOf,
} from "@/lib/format";
import type {
  ChatAccess,
  IconName,
  MessageView,
  ModeratorPermissions,
  ParticipantView,
  PollView,
  PostView,
  UserView,
} from "@/lib/types";
import { ChatRoom, rightsOf } from "./chat-room";
import { IdeaMenu } from "./idea-menu";
import { ModerationSheet } from "./moderation-sheet";
import { ParticipantSheet } from "./participant-sheet";

/** A fresh moderator starts with nothing; the author switches rights on one by one. */
const noPermissions: ModeratorPermissions = {
  can_post_media: false,
  can_pin: false,
  can_poll: false,
  can_kick: false,
};

type OpenSheet = "participants" | "moderation" | null;

/**
 * Один факт об идее — строка, а не плашка в рамке.
 *
 * Место, категория и вместимость раньше были тремя разными формами: текст с
 * иконкой, пилюля и ряд точек. Теперь это один список одинаковых строк, и
 * глаз проходит его сверху вниз, не переключаясь между формами.
 */
function Fact({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] leading-[1.4]">
      <Icon name={icon} size={17} className="mt-0.5 shrink-0 text-ink-faint" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/**
 * The idea itself, above its group chat.
 *
 * Everything that can change without a page load lives here: who is in,
 * who moderates with which rights, whether sign-up is still open, and
 * whether the viewer has joined. The chat reads its affordances from the
 * same `rights` object, so nothing is offered and then refused.
 */
export function IdeaDetail({
  post,
  viewer,
  participants: seededParticipants,
  messages,
  polls,
  permissions,
  canEnter,
  accessReason,
  now,
  historyLimited = false,
}: {
  post: PostView;
  viewer: UserView;
  participants: ParticipantView[];
  messages: MessageView[];
  polls: PollView[];
  /** Moderator rights of the viewer; null for the author, participants and guests. */
  permissions: ModeratorPermissions | null;
  /** `canEnterChat(post)`, read on the server. */
  canEnter: boolean;
  /** `chatAccessReason(post)` — set only when `canEnter` is false. */
  accessReason: string | null;
  /** The clock, read once per request by the page. */
  now: Date;
  /** Чат показывает только последние сообщения — сказать об этом. */
  historyLimited?: boolean;
}) {
  const rights = rightsOf(post.viewer_role, permissions);

  // Сообщения, голоса, участники, права и закрытие набора приходят с
  // сервера по сигналу из канала идеи; локальные правки уступают им.
  useLiveRefresh(`post:${post.id}`);

  const [closed, setClosed] = useSyncedState(post.is_closed);
  const [participants, setParticipants] = useSyncedState(seededParticipants);
  const [joined, setJoined] = useState(false);
  const [sheet, setSheet] = useState<OpenSheet>(null);

  // The roster is a sample, the counter is the real number — so local joins
  // and removals move the counter instead of replacing it.
  const participantCount = Math.max(
    0,
    post.participant_count + (participants.length - seededParticipants.length),
  );

  const exitReason = feedExitReason({ is_closed: closed, date_start: post.date_start }, now);
  const urgency = urgencyOf(post.date_start, now);
  const hot = urgency === "now" || urgency === "soon";
  const upcoming = urgency !== "past";
  const place = post.geo_address ?? post.geo_city;

  /** Why joining is off the table, for a guest who may read along. */
  const joinBlockedReason =
    exitReason === "closed"
      ? "Набор закрыт, присоединиться уже нельзя. Чат остаётся открытым — читать можно."
      : exitReason === "over"
        ? "Идея уже прошла, присоединиться нельзя. Чат остаётся открытым — читать можно."
        : isFull(post, participantCount)
          ? "Мест нет, все заняты. Присоединиться не получится."
          : null;

  const [, startTransition] = useTransition();

  /**
   * Оптимистичное изменение с откатом: экран меняется сразу, а если сервер
   * отказал, возвращается к состоянию до нажатия и говорит почему.
   */
  function commit(rollback: () => void, run: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        rollback();
        notify(result.error ?? "Не получилось. Попробуй ещё раз.");
      }
    });
  }

  function handleJoin() {
    if (joined) return;
    const beforeParticipants = participants;
    commit(
      () => {
        setJoined(false);
        setParticipants(beforeParticipants);
      },
      () => joinPost(post.id),
    );
    setJoined(true);
    setParticipants((previous) => {
      if (previous.some((row) => row.user_id === viewer.id)) return previous;
      const row: ParticipantView = {
        id: `${post.id}-pp-viewer`,
        post_id: post.id,
        user_id: viewer.id,
        joined_at: new Date().toISOString(),
        user: viewer,
        role: "participant",
        permissions: null,
      };
      return [...previous, row];
    });
  }

  function handleRemove(userId: string) {
    const before = participants;
    setParticipants((previous) => previous.filter((row) => row.user_id !== userId));
    commit(() => setParticipants(before), () => removeParticipant(post.id, userId));
  }

  function handleSetModerator(userId: string, moderator: boolean) {
    const before = participants;
    commit(() => setParticipants(before), () => setModerator(post.id, userId, moderator));
    setParticipants((previous) =>
      previous.map((row) =>
        row.user_id === userId
          ? {
              ...row,
              role: moderator ? "moderator" : "participant",
              permissions: moderator ? noPermissions : null,
            }
          : row,
      ),
    );
  }

  function handlePermissionChange(userId: string, next: ModeratorPermissions) {
    const before = participants;
    commit(() => setParticipants(before), () => updateModeratorPermissions(post.id, userId, next));
    setParticipants((previous) =>
      previous.map((row) => (row.user_id === userId ? { ...row, permissions: next } : row)),
    );
  }

  function handleCloseSignup() {
    setClosed(true);
    commit(() => setClosed(false), () => closePost(post.id));
  }

  const moderators = participants.filter((row) => row.role === "moderator");
  const hasRoster = participants.length > 0;

  const participantsLine = (
    <>
      {hasRoster ? (
        <AvatarStack users={participants.map((row) => row.user)} size="sm" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-faint">
          <Icon name="person" size={16} />
        </span>
      )}
      <span className="min-w-0 flex-1 text-[15px]">{formatParticipants(participantCount)}</span>
    </>
  );

  return (
    <>
      <PageHeader
        title={post.title}
        backHref="/"
        action={
          <div className="flex items-center gap-0.5">
            {rights.isAuthor ? (
              <IconButton
                type="button"
                label="Модерация"
                aria-haspopup="dialog"
                aria-expanded={sheet === "moderation"}
                onClick={() => setSheet("moderation")}
              >
                <Icon name="shield" size={19} />
              </IconButton>
            ) : null}
            <IdeaMenu post={post} isAuthor={rights.isAuthor} />
          </div>
        }
      />

      <section className="border-b border-line">
        <div className="px-4 pt-5 pb-5">
          {/* Время — единственное крупное место на экране: по нему и решают, успеют ли. */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <time
              dateTime={post.date_start}
              className={`u-tnum text-[32px] font-medium ${
                hot ? "text-heat" : "text-ink"
              }`}
            >
              {formatTime(post.date_start)}
            </time>
            <p className="text-[15px] text-ink-soft">{formatDayLong(post.date_start)}</p>
          </div>

          {upcoming ? (
            <p className={`mt-1.5 text-[14px] ${hot ? "text-heat" : "text-ink-soft"}`}>
              <TimeFromNow value={post.date_start} className="u-tnum" />
            </p>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <AvatarLink user={post.author} size="md" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/u/${post.author.nickname}`}
                className="flex items-center gap-1.5 text-[15px] leading-tight font-medium transition-colors hover:text-signal"
              >
                <span className="min-w-0 truncate">{post.author.nickname}</span>
                {post.author.is_verified ? <Verified size={14} className="shrink-0" /> : null}
              </Link>
              <p className="mt-0.5 text-[14px] leading-[1.4] text-ink-soft">
                {post.author.faculty
                  ? `${post.author.university.name} · ${post.author.faculty}`
                  : post.author.university.name}
              </p>
            </div>
          </div>

          <p className="mt-4 text-[15px] leading-[1.5] whitespace-pre-line text-ink">
            {post.description}
          </p>

          <ul className="mt-4 flex flex-col gap-2.5">
            <Fact icon="place">
              {place}
              {post.geo_address ? <span className="text-ink-soft">, {post.geo_city}</span> : null}
              {post.geo_mode === "radius" && post.geo_radius_m !== null ? (
                <span className="text-ink-soft"> · в радиусе {formatRadius(post.geo_radius_m)}</span>
              ) : null}
            </Fact>

            <Fact icon={post.category.icon}>{post.category.name}</Fact>

            <Fact icon="seat">
              <Seats count={participantCount} max={post.max_participants} />
            </Fact>
          </ul>

          {/* Карта — только для «области»: это место автор показал сам. В
              режиме радиуса точка — где был автор, её не рисуем. */}
          {post.geo_mode === "area" && post.geo_lat != null && post.geo_lng != null ? (
            <div className="mt-4">
              <MapView
                center={{ lat: post.geo_lat, lng: post.geo_lng }}
                radiusM={AREA_RADIUS_M}
                zoom={16}
                className="h-48"
                label={`Карта: место встречи около ${place}, круг около ${AREA_RADIUS_M} метров.`}
              />
            </div>
          ) : null}

          {exitReason ? (
            <div className="mt-5 rounded-field bg-sunken p-4">
              <p className="text-[15px] font-medium">
                {exitReason === "closed" ? "Набор закрыт" : "Уже прошла"}
              </p>
              <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
                {exitReason === "closed"
                  ? "Идея больше не в ленте, присоединиться нельзя. Чат остаётся открытым для всех, кто в нём."
                  : "Идея больше не в ленте. Чат остаётся открытым — в нём можно договориться о следующем разе."}
              </p>
            </div>
          ) : null}
        </div>

        {/* Участники — своя строка между линиями, без рамки вокруг. */}
        <div className="border-t border-line px-4">
          {hasRoster ? (
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheet === "participants"}
              onClick={() => setSheet("participants")}
              className="flex min-h-12 w-full items-center gap-3 py-3 text-left"
            >
              {participantsLine}
              <span className="sr-only">Показать список участников</span>
              <Icon name="chevron" size={18} className="shrink-0 text-ink-faint" />
            </button>
          ) : (
            <div className="flex min-h-12 w-full items-center gap-3 py-3">{participantsLine}</div>
          )}
        </div>
      </section>

      {canEnter ? (
        <ChatRoom
          postId={post.id}
          viewer={viewer}
          rights={rights}
          members={participants}
          historyLimited={historyLimited}
          messages={messages}
          polls={polls}
          joined={joined}
          onJoin={handleJoin}
          joinBlockedReason={joinBlockedReason}
        />
      ) : (
        <ClosedChat author={post.author} reason={accessReason} access={post.chat_access} />
      )}

      <ParticipantSheet
        open={sheet === "participants"}
        onClose={() => setSheet(null)}
        participants={participants}
        viewerId={viewer.id}
        isAuthor={rights.isAuthor}
        canKick={rights.canKick}
        onRemove={handleRemove}
        onSetModerator={handleSetModerator}
      />

      {rights.isAuthor ? (
        <ModerationSheet
          open={sheet === "moderation"}
          onClose={() => setSheet(null)}
          moderators={moderators}
          isClosed={closed}
          onPermissionChange={handlePermissionChange}
          onCloseSignup={handleCloseSignup}
          onOpenParticipants={() => setSheet("participants")}
        />
      ) : null}
    </>
  );
}

/**
 * What a visitor sees when the author limited the chat: the idea above stays
 * readable, the chat does not open, and the one thing that would change that
 * — following the author — is one tap away on their profile.
 */
function ClosedChat({
  author,
  reason,
  access,
}: {
  author: UserView;
  reason: string | null;
  access: ChatAccess;
}) {
  return (
    <section className="px-4 py-5">
      <div className="rounded-field bg-sunken p-4">
        <p className="flex items-center gap-2 text-[15px] font-medium">
          <Icon name="lock" size={17} className="shrink-0 text-ink-faint" />
          В этот чат не зайти
        </p>

        {reason ? (
          <p className="mt-1.5 text-[14px] leading-[1.5] text-ink-soft">{reason}</p>
        ) : null}
        <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
          {access === "friends"
            ? `Друзьями вы станете, когда подпишетесь друг на друга.`
            : `Подпишись на ${author.nickname}, и чат откроется.`}
        </p>

        <Link
          href={`/u/${author.nickname}`}
          className="mt-2.5 inline-flex min-h-10 items-center text-[15px] text-signal"
        >
          Открыть профиль
        </Link>
      </div>
    </section>
  );
}
