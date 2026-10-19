import { groupHeading, listLead, listTime } from "@/components/ui/list-row";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Pill } from "@/components/ui/pill";
import { Seats } from "@/components/ui/seats";
import { feedExitReason, formatDayLabel, formatTime, urgencyOf, shortPlace } from "@/lib/format";
import { getActivePostsByAuthor, getPastPostsByAuthor, getViewer } from "@/lib/data";
import type { PostView, UserView } from "@/lib/types";

/**
 * The ideas a person hosts, as a timetable: departure time on the left, the
 * plan beside it. Ideas that are over or closed drop into a quieter second
 * group — they leave the feed, but their chat stays reachable.
 *
 * Строка повторяет эталон ленты, только без аватара: мы уже в профиле этого
 * человека, и повторять его лицо в каждой строке незачем. Элемент лежит на
 * фоне и отделён снизу линией — ни рамки, ни второго фона под ним.
 */
export async function ProfilePosts({ user, now }: { user: UserView; now: Date }) {
  const [viewer, open, over] = await Promise.all([
    await getViewer(),
    await getActivePostsByAuthor(user.id, now),
    await getPastPostsByAuthor(user.id, now),
  ]);
  const isViewer = user.id === viewer.id;

  if (open.length === 0 && over.length === 0) {
    return isViewer ? (
      <EmptyState
        icon="sparkle"
        title="У тебя пока нет идей"
        body="Напиши, что хочешь сделать. Кто захочет с тобой — соберётся в чате."
        action={<ButtonLink href="/create">Создать идею</ButtonLink>}
      />
    ) : (
      <EmptyState
        icon="sparkle"
        title={`У ${user.nickname} пока нет идей`}
        body="Здесь появятся идеи этого человека. А пока посмотри, что затевают другие."
        action={
          <ButtonLink href="/search" variant="quiet">
            Искать идеи
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div>
      {open.length > 0 ? (
        <section>
          <h2 className={groupHeading}>Открытые идеи</h2>
          <ul className="u-feed">
            {open.map((post) => (
              <PostRow key={post.id} post={post} now={now} />
            ))}
          </ul>
        </section>
      ) : null}

      {over.length > 0 ? (
        <section>
          <h2 className="px-4 pt-5 text-[13px] font-medium text-ink-faint">
            Закрытые и прошедшие
          </h2>
          <p className="px-4 pt-0.5 pb-1.5 text-[13px] text-ink-soft">
            Чаты остаются доступными для всех, кто был внутри.
          </p>
          <ul className="u-feed">
            {over.map((post) => (
              <PostRow key={post.id} post={post} now={now} past />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PostRow({ post, now, past = false }: { post: PostView; now: Date; past?: boolean }) {
  const reason = past ? feedExitReason(post, now) : null;
  const urgency = urgencyOf(post.date_start, now);
  const soon = !past && (urgency === "now" || urgency === "soon");

  return (
    <li className="u-feed-divider">
      <Link
        href={`/post/${post.id}`}
        className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-sunken"
      >
        <time
          dateTime={post.date_start}
          className={`${listLead} ${listTime} ${
            soon ? "text-heat" : "text-ink"
          }`}
        >
          <span className="sr-only">Начало в </span>
          {formatTime(post.date_start)}
        </time>

        <span className="min-w-0 flex-1">
          <span
            className={`block text-[16px] leading-[1.4] font-medium ${
              past ? "text-ink-soft" : "text-ink"
            }`}
          >
            {post.title}
          </span>

          <span className="mt-0.5 flex items-center gap-x-1.5 overflow-hidden text-[14px] whitespace-nowrap text-ink-soft">
            <span className="u-tnum shrink-0">{formatDayLabel(post.date_start, now)}</span>
            <span aria-hidden className="shrink-0">·</span>
            <span className="min-w-0 truncate">{shortPlace(post.geo_address, post.geo_city)}</span>
            {reason ? (
              <Pill className="shrink-0">{reason === "closed" ? "Набор закрыт" : "Уже прошла"}</Pill>
            ) : (
              <>
                <span aria-hidden className="shrink-0">·</span>
                <span className="shrink-0">
                  <Seats count={post.participant_count} max={post.max_participants} />
                </span>
              </>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
