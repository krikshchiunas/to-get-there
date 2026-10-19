import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { pluralRu } from "@/lib/format";
import { unreadNotificationCount } from "@/lib/mock";
import type { FeedTab } from "@/lib/types";

/**
 * Шапка ленты. На телефоне — логотип и путь к уведомлениям; от `md` рельс
 * навигации делает и то и другое, поэтому остаются только две вкладки.
 * Липкая, чтобы переключение вкладок не требовало скролла наверх.
 *
 * Оформления у шапки нет: логотип набран той же гарнитурой, что и всё
 * остальное, линию снизу рисует `Segmented`. Её высота — то, под что
 * подлипает `DayGroup`.
 */
export function FeedHeader({ tab }: { tab: FeedTab }) {
  const hasUnread = unreadNotificationCount > 0;

  return (
    <header className="sticky top-0 z-20 bg-paper/92 backdrop-blur-sm">
      <h1 className="sr-only">Идеи</h1>

      <div className="flex h-12 items-center justify-between px-4 md:hidden">
        <span className="text-[17px] leading-none font-semibold">To Get There</span>

        <Link
          href="/notifications"
          aria-label={
            hasUnread
              ? `Уведомления, ${unreadNotificationCount} ${pluralRu(unreadNotificationCount, [
                  "непрочитанное",
                  "непрочитанных",
                  "непрочитанных",
                ])}`
              : "Уведомления"
          }
          className="relative -mr-2 flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
        >
          <Icon name="bell" size={21} />
          {hasUnread ? (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-signal ring-2 ring-paper"
            />
          ) : null}
        </Link>
      </div>

      <Segmented
        ariaLabel="Лента"
        active={tab}
        items={[
          { value: "following", label: "Подписки", href: "/?tab=following" },
          { value: "university", label: "Университет", href: "/?tab=university" },
        ]}
      />
    </header>
  );
}
