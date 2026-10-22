import type { ComponentProps, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { IconName } from "@/lib/types";
import { Icon } from "./icon";

// Поле — заливка, а не рамка: на длинной форме рамки складываются в сетку,
// от которой экран и выглядит тяжёлым.
const control =
  "w-full rounded-field bg-sunken px-3.5 py-3 text-[15px] " +
  "outline-none transition-shadow focus:ring-2 focus:ring-signal/35 disabled:opacity-50";

/** Label, hint and error around any control. Errors say how to fix it. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
        {required ? null : <span className="ml-1.5 font-normal text-ink-faint">необязательно</span>}
      </label>
      {hint ? <p className="text-[12px] text-ink-faint">{hint}</p> : null}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[12px] text-heat" role="alert">
          <Icon name="close" size={12} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Поле ввода. `ref` проходит насквозь (React 19) — формы входа переводят фокус на поле с ошибкой. */
export function TextInput({ className = "", ...rest }: ComponentProps<"input">) {
  return <input className={`${control} ${className}`} {...rest} />;
}

export function TextArea({ className = "", rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={`${control} resize-y leading-relaxed ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${control} appearance-none pr-10 ${className}`} {...rest}>
      {children}
    </select>
  );
}

/** Counter under a length-limited input. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <p className={`u-tnum text-right text-[12px] ${over ? "text-heat" : "text-ink-faint"}`}>
      {value.length}/{max}
    </p>
  );
}

/** A single on/off setting, as a full-width row. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[15px] leading-snug">{label}</p>
        {description ? <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-40",
          checked ? "bg-signal" : "bg-line-strong",
        ].join(" ")}
      >
        <span
          className="absolute top-0.5 size-5 rounded-full bg-surface transition-[left] duration-150"
          style={{ left: checked ? "22px" : "2px" }}
        />
      </button>
    </div>
  );
}

/** One option in a radio list. The whole row is the target. */
export function RadioRow({
  name,
  value,
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  icon?: IconName;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-start gap-3 rounded-field p-3.5 transition-colors",
        checked ? "bg-signal-wash ring-1 ring-signal/40" : "bg-sunken hover:bg-line",
      ].join(" ")}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        aria-label={label}
        className="sr-only"
      />
      <span
        aria-hidden
        className={[
          "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-signal" : "border-ink-faint",
        ].join(" ")}
      >
        {checked ? <span className="size-2 rounded-full bg-signal" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] leading-snug">
          {icon ? <Icon name={icon} size={15} className="text-ink-soft" /> : null}
          {label}
        </span>
        {description ? <span className="mt-0.5 block text-[13px] text-ink-soft">{description}</span> : null}
      </span>
    </label>
  );
}

/** Groups settings rows under a heading, with hairlines between them. */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1">
      <h2 className="text-[13px] font-medium text-ink-faint">{title}</h2>
      {description ? <p className="pb-1 text-[13px] text-ink-soft">{description}</p> : null}
      <div className="divide-y divide-line rounded-card bg-sunken px-4">{children}</div>
    </section>
  );
}
