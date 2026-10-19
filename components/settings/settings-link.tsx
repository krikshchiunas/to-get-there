import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import type { IconName } from "@/lib/types";

/**
 * Строки хаба настроек.
 *
 * Такая же строка списка, как в ленте и в уведомлениях: лежит на фоне, во всю
 * ширину колонки, снизу — линия. Иконка раздела идёт без кружка и без рамки:
 * в списке из восьми строк восемь обведённых кружков читаются как сетка, а не
 * как список.
 */

export function SettingsLink({
  href,
  icon,
  label,
  description,
  value,
}: {
  href: string;
  icon: IconName;
  label: string;
  /** Одна строка о том, что внутри. */
  description: string;
  /** Текущее состояние раздела, если его стоит видеть, не заходя внутрь. */
  value?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="u-feed-divider flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken"
    >
      <span aria-hidden className="flex w-avatar shrink-0 justify-center text-ink-soft">
        <Icon name={icon} size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-[1.4]">{label}</span>
        <span className="mt-0.5 block text-[14px] leading-[1.4] text-ink-soft">{description}</span>
        {value ? <span className="mt-1.5 flex">{value}</span> : null}
      </span>

      <Icon name="chevron" size={18} className="shrink-0 text-ink-faint" />
    </Link>
  );
}

/**
 * Строка того, чего ещё нет. Намеренно не контрол: нажимать нечего, поэтому
 * здесь нет ни кнопки, ни ссылки — только пометка «скоро».
 */
export function SettingsRowSoon({
  icon,
  label,
  description,
}: {
  icon: IconName;
  label: string;
  description: string;
}) {
  return (
    <div className="u-feed-divider flex items-center gap-3 px-4 py-3.5">
      <span aria-hidden className="flex w-avatar shrink-0 justify-center text-ink-faint">
        <Icon name={icon} size={20} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-[1.4] text-ink-soft">{label}</p>
        <p className="mt-0.5 text-[14px] leading-[1.4] text-ink-faint">{description}</p>
      </div>

      <Pill>скоро</Pill>
    </div>
  );
}
