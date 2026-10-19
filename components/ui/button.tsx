import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

/**
 * Кнопки сняты с живых лент: пилюля, вес 400, вторичная — светлая заливка
 * без рамки, теней нет ни у одной. Рамка вокруг кнопки добавляет на экран
 * ещё одну линию, а их в ленте и так достаточно.
 */
export type ButtonVariant = "primary" | "quiet" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-45 select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-signal text-signal-ink hover:bg-signal/90 active:bg-signal/80",
  quiet: "bg-sunken text-ink hover:bg-line",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
  danger: "bg-heat-wash text-heat hover:bg-heat/15",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[14px]",
  md: "h-9 px-4 text-[15px]",
  lg: "h-11 px-5 text-[15px]",
};

function classesFor(variant: ButtonVariant, size: ButtonSize, full?: boolean, extra?: string) {
  return [base, variants[variant], sizes[size], full ? "w-full" : "", extra ?? ""]
    .filter(Boolean)
    .join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={classesFor(variant, size, full, className)} {...rest}>
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  full,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classesFor(variant, size, full, className)} {...rest}>
      {children}
    </Link>
  );
}

/** Иконка-действие для панелей и композера. */
export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  ...rest
}: Omit<ButtonProps, "children" | "size" | "full"> & { label: string; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={[
        "inline-flex size-9 items-center justify-center rounded-full transition-colors",
        variants[variant],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
