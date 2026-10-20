import type { Metadata } from "next";
import { DayGroup } from "@/components/feed/day-group";
import { FeedHeader } from "@/components/feed/feed-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { dayKey, formatDayLabel } from "@/lib/format";
import { getFeed } from "@/lib/data";
import type { FeedTab, PostView } from "@/lib/types";

/** The feed depends on the clock, so it is rendered per request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Идеи",
};

function tabFrom(value: string | string[] | undefined): FeedTab {
  return value === "following" ? "following" : "university";
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
  const groups = groupByDay(await getFeed(tab, now));

  return (
    <>
      <FeedHeader tab={tab} />

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
            title="В твоём вузе пока ничего не задумали"
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

          <p className="px-4 py-6 text-[13px] leading-[1.4] text-ink-faint">
            Идея пропадает из ленты, когда автор закрыл набор или прошёл час после начала. Чат остаётся
            открытым — для всех, кто уже в нём.
          </p>
        </>
      )}
    </>
  );
}
