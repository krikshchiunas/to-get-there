import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icon";

/** Sticky header for every screen below the feed. */
export function PageHeader({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/92 backdrop-blur-sm">
      <div className="flex min-h-14 items-center gap-2 px-2.5 py-2">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Назад"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-sunken"
          >
            <Icon name="back" size={19} />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-[17px] font-semibold">{title}</h1>
          {subtitle ? <div className="truncate text-[13px] text-ink-soft">{subtitle}</div> : null}
        </div>

        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
    </header>
  );
}
