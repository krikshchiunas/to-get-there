import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { LegalFooter } from "@/components/legal/legal-footer";

/**
 * Юридические страницы открыты без входа (lib/public-paths.ts): Impressum и
 * политику конфиденциальности должно быть видно до регистрации. Поэтому
 * здесь своя оболочка без навигации приложения — как у экранов входа.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="u-column flex min-h-dvh flex-col px-5 pt-8 pb-12 md:pt-14">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href="/" className="text-[18px] leading-tight font-semibold">
          To Get There
        </Link>
        <Link
          href="/legal"
          className="inline-flex min-h-10 items-center gap-1.5 text-[14px] text-ink-soft hover:text-ink"
        >
          <Icon name="note" size={16} />
          Все документы
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <LegalFooter />
    </div>
  );
}
