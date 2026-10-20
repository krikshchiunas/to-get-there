import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Seats } from "@/components/ui/seats";
import { Verified } from "@/components/ui/verified";
import { listLead, listRow, verifiedSize } from "@/components/ui/list-row";
import { formatDayLabel, formatTime, urgencyOf, shortPlace } from "@/lib/format";
import type { PostView } from "@/lib/types";

/**
 * Идея в результатах поиска — это та же строка ленты, что и везде в
 * приложении: аватар слева как якорь, «ник · вуз» и время в первой строке,
 * название, две строки описания и одна служебная строка под ними.
 *
 * Рамки, скругления и второго фона здесь нет: строка лежит на фоне экрана и
 * отделена снизу линией во всю ширину колонки. Так лента отличается от
 * списка карточек, и так ведут себя все изученные ленты.
 *
 * Цвет в строке ровно один и только при цейтноте: `heat` на времени, когда
 * `urgencyOf` читается как `now` или `soon`. Вся строка — одна цель нажатия
 * через растянутую ссылку названия; ссылка на автора поднята над ней, чтобы
 * ссылка никогда не оказалась внутри ссылки.
 */
export function ResultCard({ post, now }: { post: PostView; now: Date }) {
  const urgency = urgencyOf(post.date_start, now);
  const isHot = urgency === "now" || urgency === "soon";
  const place = shortPlace(post.geo_address, post.geo_city);

  return (
    <li className={listRow}>
      <span className={listLead}>
        <Avatar user={post.author} size="md" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/u/${post.author.nickname}`}
            className="relative z-10 flex min-w-0 items-center gap-1 text-[15px] font-medium"
          >
            <span className="truncate">{post.author.nickname}</span>
            {post.author.is_verified ? <Verified size={verifiedSize} className="shrink-0" /> : null}
          </Link>

          <span aria-hidden className="text-[14px] text-ink-soft">
            ·
          </span>
          <span className="truncate text-[14px] text-ink-soft">{post.author.university.short_name}</span>

          <time
            dateTime={post.date_start}
            className={[
              "u-tnum ml-auto shrink-0 pl-2 text-[15px] font-medium",
              isHot ? "text-heat" : "text-ink",
            ].join(" ")}
          >
            <span className="sr-only">Начало в </span>
            {formatTime(post.date_start)}
          </time>
        </div>

        <h3 className="mt-0.5 text-[16px] leading-[1.35] font-medium">
          <Link href={`/post/${post.id}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>

        <p className="u-clamp-2 mt-0.5 text-[15px] leading-[1.4] text-ink-soft">{post.description}</p>

        {/* Одна строка, что бы в неё ни попало: длинный адрес ужимается, а
            день и места остаются целыми — по ним и принимают решение. */}
        <p className="mt-1.5 flex items-center gap-x-1.5 text-[14px] whitespace-nowrap text-ink-soft">
          <span className="u-tnum shrink-0">{formatDayLabel(post.date_start, now)}</span>
          <span aria-hidden className="shrink-0">
            ·
          </span>
          <span className="min-w-0 truncate">{place}</span>
          <span aria-hidden className="shrink-0">
            ·
          </span>
          <Seats count={post.participant_count} max={post.max_participants} className="shrink-0" />
        </p>
      </div>
    </li>
  );
}
