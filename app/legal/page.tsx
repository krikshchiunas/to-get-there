import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/lib/types";

export const metadata: Metadata = {
  title: "Документы",
  description: "Impressum, конфиденциальность, условия использования и правила сообщества To Get There.",
};

const documents: { href: string; icon: IconName; title: string; body: string }[] = [
  {
    href: "/legal/community",
    icon: "heart",
    title: "Правила сообщества",
    body: "Что здесь можно, что нельзя, как пожаловаться.",
  },
  {
    href: "/legal/privacy",
    icon: "lock",
    title: "Конфиденциальность",
    body: "Какие данные мы храним, зачем, где и сколько.",
  },
  {
    href: "/legal/terms",
    icon: "note",
    title: "Условия использования",
    body: "Кто может пользоваться сервисом и на каких условиях.",
  },
  {
    href: "/legal/impressum",
    icon: "book",
    title: "Impressum",
    body: "Кто отвечает за сервис и как связаться.",
  },
];

export default function LegalIndex() {
  return (
    <>
      <h1 className="mb-6 text-[24px] leading-tight font-semibold">Документы</h1>
      <ul className="-mx-5 border-t border-line">
        {documents.map((doc) => (
          <li key={doc.href} className="border-b border-line">
            <Link
              href={doc.href}
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-sunken"
            >
              <Icon name={doc.icon} size={20} className="shrink-0 text-ink-soft" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{doc.title}</span>
                <span className="block text-[14px] text-ink-soft">{doc.body}</span>
              </span>
              <Icon name="chevron" size={18} className="shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
