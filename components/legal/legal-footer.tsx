import Link from "next/link";

/** Ссылки на все документы — внизу юридических страниц и экранов входа. */
export function LegalFooter() {
  return (
    <footer className="mt-12 border-t border-line pt-5">
      <nav aria-label="Документы">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
          <li>
            <Link href="/legal/impressum" className="inline-flex min-h-10 items-center hover:text-ink">
              Impressum
            </Link>
          </li>
          <li>
            <Link href="/legal/privacy" className="inline-flex min-h-10 items-center hover:text-ink">
              Конфиденциальность
            </Link>
          </li>
          <li>
            <Link href="/legal/terms" className="inline-flex min-h-10 items-center hover:text-ink">
              Условия
            </Link>
          </li>
          <li>
            <Link href="/legal/community" className="inline-flex min-h-10 items-center hover:text-ink">
              Правила сообщества
            </Link>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
