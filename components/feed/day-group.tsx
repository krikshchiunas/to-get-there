import { groupHeading } from "@/components/ui/list-row";
import type { PostView } from "@/lib/types";
import { PostCard } from "./post-card";

/**
 * Один день в ленте: липкий заголовок дня, под ним идеи этого дня по порядку.
 * Рельса времени убрана — у строк есть аватар как якорь и время справа, а
 * вертикальная линия добавляла на экран третий уровень структуры.
 *
 * `u-feed` снимает линию у последней строки группы, чтобы заголовок
 * следующего дня не садился на двойной разделитель.
 *
 * Липкое смещение — высота шапки ленты: строка логотипа плюс вкладки на
 * телефоне, одни вкладки от `md`, где логотип показывает рельс навигации.
 */
export function DayGroup({ label, posts, now }: { label: string; posts: PostView[]; now: Date }) {
  return (
    <section>
      <h2 className={groupHeading}>{label}</h2>

      <div className="u-feed">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} now={now} />
        ))}
      </div>
    </section>
  );
}
