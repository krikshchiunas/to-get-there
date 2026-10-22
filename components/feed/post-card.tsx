import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { listLead, listRow } from "@/components/ui/list-row";
import { Icon } from "@/components/ui/icon";
import { Seats } from "@/components/ui/seats";
import { Verified } from "@/components/ui/verified";
import { formatParticipants, formatRadius, formatTime, shortPlace, urgencyOf } from "@/lib/format";
import { canEnterChat, chatAccessReason } from "@/lib/access";
import type { PostView } from "@/lib/types";

/**
 * Одна идея в ленте — эталонная строка приложения.
 *
 * Строка лежит прямо на фоне и отделена снизу линией: ни рамки по кругу, ни
 * второго фона, ни тени. Аватар слева — якорь, всё содержание течёт справа от
 * него одной колонкой: кто и когда, что задумал, пояснение, метаданные.
 *
 * Вся строка — одна цель нажатия: название растянуто через `after:inset-0`,
 * ссылка на автора поднята над ним через `z-10`. Вложенных `<a>` нет.
 */
export function PostCard({ post, now }: { post: PostView; now: Date }) {
  const urgency = urgencyOf(post.date_start, now);
  const isHot = urgency === "now" || urgency === "soon";
  const openToViewer = canEnterChat(post);
  const blockedReason = chatAccessReason(post);
  const reasonId = `chat-access-${post.id}`;

  const placeName = shortPlace(post.geo_address, post.geo_city);
  const place =
    post.geo_mode === "radius" && post.geo_radius_m !== null
      ? `${placeName}, в радиусе ${formatRadius(post.geo_radius_m)}`
      : placeName;

  return (
    <article className={`${listRow} isolate`}>
      <span className={listLead}>
        <Avatar user={post.author} size="md" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <Link
            href={`/u/${post.author.nickname}`}
            className="relative z-10 flex min-w-0 shrink items-center gap-1 text-[15px] font-medium text-ink"
          >
            <span className="truncate">{post.author.nickname}</span>
            {post.author.is_verified ? <Verified size={14} className="shrink-0" /> : null}
          </Link>

          <span className="min-w-0 flex-1 truncate text-[15px] text-ink-soft">
            {post.author.university?.short_name}
          </span>

          <time
            dateTime={post.date_start}
            className={`u-tnum shrink-0 text-[15px] font-medium ${isHot ? "text-heat" : "text-ink"}`}
          >
            <span className="sr-only">Начало в </span>
            {formatTime(post.date_start)}
          </time>
        </div>

        <h3 className="mt-0.5 text-[16px] leading-[1.35] font-medium text-ink">
          <Link href={`/post/${post.id}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>

        <p className="u-clamp-2 mt-0.5 text-[15px] leading-[1.4] text-ink-soft">{post.description}</p>

        <div className="mt-1.5 flex items-center gap-2 text-[14px] text-ink-soft">
          <p className="flex min-w-0 flex-1 items-center gap-1">
            <span className="truncate">{place}</span>
            <span aria-hidden className="text-ink-faint">
              ·
            </span>
            <Seats
              count={post.participant_count}
              max={post.max_participants}
              className="shrink-0 whitespace-nowrap"
            />
          </p>

          <p
            className={`flex shrink-0 items-center gap-1 ${openToViewer ? "" : "text-ink-faint"}`}
            aria-describedby={!openToViewer && blockedReason ? reasonId : undefined}
          >
            <Icon name={openToViewer ? "chat" : "lock"} size={16} />
            <span aria-hidden className="u-tnum">
              {post.participant_count}
            </span>
            <span className="sr-only">
              {formatParticipants(post.participant_count)} в чате идеи
              {openToViewer ? "" : ", вход закрыт"}
            </span>
          </p>
        </div>

        {!openToViewer && blockedReason ? (
          <p id={reasonId} className="mt-1 text-[13px] leading-[1.4] text-ink-faint">
            {blockedReason}
          </p>
        ) : null}
      </div>
    </article>
  );
}
