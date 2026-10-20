import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Golos_Text } from "next/font/google";
import "./globals.css";

/**
 * Одна гарнитура на всё приложение. Threads, Bluesky и Instagram держат
 * ровно одно семейство и отличают элементы размером и цветом, а не второй
 * гарнитурой — от этого лента и читается лёгкой. Golos Text кириллическая
 * по происхождению, поэтому русский набирается, а не подставляется
 * системным шрифтом.
 */
const sans = Golos_Text({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--f-sans",
  display: "swap",
});

/**
 * Абсолютный адрес для превью ссылок (og:image и т. п.): та же цепочка, что
 * в lib/site-url.ts, но без заголовка Host — метаданные собираются вне запроса.
 */
const siteOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: "To Get There",
    template: "%s · To Get There",
  },
  description:
    "Напиши, что хочешь сделать. Кто с тобой — соберётся в чате этой идеи. Для студентов университетов Германии.",
  applicationName: "To Get There",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
};

/**
 * Каждая страница рендерится на запрос. CSP (middleware.ts) разрешает только
 * скрипты с nonce этого запроса, а Next проставляет nonce лишь при
 * динамическом рендере: у страницы, собранной заранее, скрипты без nonce, и
 * браузер их блокирует — страница не оживает. Нашёл E2E (e2e/screens.spec.ts).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="ru" className={sans.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
