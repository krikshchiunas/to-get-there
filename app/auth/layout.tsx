import { LegalFooter } from "@/components/legal/legal-footer";

/** Экраны входа: одна узкая колонка, без навигации — заходить ещё некуда. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="u-column flex min-h-dvh flex-col px-5 pt-14 pb-10 md:pt-24">
      <p className="mb-10 text-[18px] leading-tight font-semibold">To Get There</p>
      <div className="flex-1">{children}</div>
      <LegalFooter />
    </main>
  );
}
