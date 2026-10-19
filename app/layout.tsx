import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={sans.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
