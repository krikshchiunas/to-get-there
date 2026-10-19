import Link from "next/link";
import type { ReactNode } from "react";
import type { IconName } from "@/lib/types";
import { Icon } from "./icon";

export type PillTone = "default" | "signal" | "heat" | "verified" | "outline";

const tones: Record<PillTone, string> = {
  default: "bg-sunken text-ink-soft",
  signal: "bg-signal-wash text-signal",
  heat: "bg-heat-wash text-heat",
  verified: "bg-sunken text-verified",
  // Раньше здесь была рамка. Заливка весит на экране меньше линии.
  outline: "bg-sunken text-ink-soft",
};

export function Pill({
  children,
  icon,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  icon?: IconName;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[12px] leading-[18px] ${tones[tone]} ${className}`}
    >
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

/** Filter and category chips. Renders as a link when `href` is given. */
export function ChipLink({
  children,
  href,
  icon,
  active = false,
}: {
  children: ReactNode;
  href: string;
  icon?: IconName;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-2 text-[14px] transition-colors",
        active
          ? "bg-signal text-signal-ink"
          : "bg-sunken text-ink-soft hover:text-ink",
      ].join(" ")}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </Link>
  );
}

export function ChipButton({
  children,
  icon,
  active = false,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  icon?: IconName;
  active?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-2 text-[14px] transition-colors",
        active
          ? "bg-signal text-signal-ink"
          : "bg-sunken text-ink-soft hover:text-ink",
      ].join(" ")}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}
