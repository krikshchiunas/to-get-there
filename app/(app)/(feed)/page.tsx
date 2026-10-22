import type { Metadata } from "next";
import Link from "next/link";
import { DayGroup } from "@/components/feed/day-group";
import { FeedHeader } from "@/components/feed/feed-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { dayKey, formatDayLabel } from "@/lib/format";
import { FEED_MAX, FEED_PAGE, getFeed, getViewer } from "@/lib/data";
import type { FeedTab, PostView } from "@/lib/types";

/** The feed depends on the clock, so it is rendered per request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Идеи",
};

function tabFrom(value: string | string[] | undefined): FeedTab {
  return value === "following" ? "following" : "university";
}

/** Сколько страниц ленты показать: ?pages=2 — сто ближайших идей. */
function pagesFrom(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  const most = FEED_MAX / FEED_PAGE;
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, most) : 1;
}

/**
 * Groups an already chronological feed into days without resorting it, so the
 * next departure stays first and each day keeps its own order.
 */
function groupByDay(list: PostView[]): Array<{ key: string; posts: PostView[] }> {
  const groups: Array<{ key: string; posts: PostView[] }> = [];

  for (const post of list) {
    const key = dayKey(post.date_start);
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.posts.push(post);
    } else {
      groups.push({ key, posts: [post] });
    }
  }

  return groups;
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const now = new Date();
  const params = await searchParams;
  const tab = tabFrom(params.tab);
  const pages = pagesFrom(params.pages);
  const [{ posts, hasMore }, viewer] = await Promise.all([getFeed(tab, now, pages * FEED_PAGE), getViewer()]);
  const hasUniversity = viewer.university !== null;
  const groups = groupByDay(posts);
  const canGrow = hasMore && (pages + 1) * FEED_PAGE <= FEED_MAX;

  return (
    <>
      <FeedHeader tab={tab} hasUniversity={hasUniversity} />

      {groups.length === 0 ? (
        tab === "following" ? (
          <EmptyState
            icon="person"
            title="У твоих подписок пока нет идей"
            body="Здесь будут идеи тех, на кого ты подписан. Найди студентов, подпишись — и вкладка заполнится."
            action={
              <ButtonLink href="/search" variant="quiet" size="md">
                Найти людей
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon="plus"
            title={hasUniversity ? "В твоём вузе пока ничего не задумали" : "Пока ничего не задумали"}
            body="Предложи идею первым. Хватит одной фразы: что хочешь сделать, когда и где."
            action={
              <ButtonLink href="/create" size="md">
                Создать идею
              </ButtonLink>
            }
          />
        )
      ) : (
        <>
          {groups.map((group) => (
            <DayGroup
              key={group.key}
              label={formatDayLabel(group.posts[0].date_start, now)}
              posts={group.posts}
              now={now}
            />
          ))}

          {canGrow ? (
            <div className="px-4 pt-6">
              {/* Ссылка, а не кнопка с запросом из браузера: лента остаётся
                  серверной, а scroll={false} держит прокрутку на месте. */}
              <ButtonLink
                href={`/?tab=${tab}&pages=${pages + 1}`}
                scroll={false}
                variant="quiet"
                size="lg"
                full
              >
                Показать ещё
              </ButtonLink>
            </div>
          ) : hasMore ? (
            <p className="px-4 pt-6 text-[14px] leading-[1.4] text-ink-soft">
              Это ближайшие {FEED_MAX} идей. Что дальше по времени — найдётся в{" "}
              <Link href="/search" className="text-signal underline underline-offset-2">
                поиске по дате
              </Link>
              .
            </p>
          ) : null}

          <p className="px-4 py-6 text-[13px] leading-[1.4] text-ink-faint">
            Идея пропадает из ленты, когда автор закрыл набор или прошёл час после начала. Чат остаётся
            открытым — для всех, кто уже в нём.
          </p>
        </>
      )}
    </>
  );
}
