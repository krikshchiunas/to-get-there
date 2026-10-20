import type { ReactNode } from "react";

/**
 * Длинный текст документа. Та же гарнитура и те же цвета, что в приложении:
 * заголовки разделов — 17px/600, текст — 15px с межстрочным 1.6, чтобы
 * абзацы читались, а не сливались в стену. Ссылки в тексте подчёркнуты: одного
 * цвета мало, чтобы отличить их (WCAG 1.4.1).
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <article className="space-y-4 text-[15px] leading-[1.6] text-ink [&_a]:text-signal [&_a]:underline [&_a]:underline-offset-2 [&_h2]:pt-4 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h3]:pt-2 [&_h3]:text-[15px] [&_h3]:font-medium [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
      {children}
    </article>
  );
}

export function DocTitle({
  title,
  subtitle,
  revision,
}: {
  title: string;
  subtitle?: string;
  revision: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-[24px] leading-tight font-semibold">{title}</h1>
      {subtitle ? <p className="mt-1 text-[15px] text-ink-soft">{subtitle}</p> : null}
      <p className="mt-2 text-[13px] text-ink-faint">Редакция от {revision}</p>
    </div>
  );
}
