import Link from "next/link";

/**
 * Tab switcher. Rendered as an underline on the baseline rather than a pill
 * in a tray, so it reads as part of the page rule it sits on.
 */
export interface SegmentItem {
  value: string;
  label: string;
  href?: string;
  count?: number;
}

export function Segmented({
  items,
  active,
  ariaLabel,
}: {
  items: SegmentItem[];
  active: string;
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="flex border-b border-line px-1">
      {items.map((item) => {
        const isActive = item.value === active;
        const content = (
          <>
            {item.label}
            {item.count != null && item.count > 0 ? (
              <span className="u-tnum ml-1.5 text-[12px] text-ink-faint">{item.count}</span>
            ) : null}
          </>
        );

        const className = [
          "relative px-3.5 pb-3 pt-3.5 text-[15px] transition-colors",
          isActive ? "font-medium text-ink" : "text-ink-soft hover:text-ink",
        ].join(" ");

        const underline = isActive ? (
          <span aria-hidden className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-signal" />
        ) : null;

        return item.href ? (
          <Link
            key={item.value}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={className}
          >
            {content}
            {underline}
          </Link>
        ) : (
          <span key={item.value} aria-current={isActive ? "true" : undefined} className={className}>
            {content}
            {underline}
          </span>
        );
      })}
    </nav>
  );
}
