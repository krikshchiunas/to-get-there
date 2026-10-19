import { headers } from "next/headers";

/**
 * Адрес сайта для ссылок, которые уходят наружу: в письма подтверждения и в
 * return_url проверки личности.
 *
 * Сначала — явная настройка, потом — продовый домен, который Vercel кладёт
 * в окружение сам. Заголовок Host — только для локальной разработки: его
 * присылает клиент, и подставлять его в ссылки на проде нельзя.
 */
export async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const store = await headers();
  const host = store.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return `${local ? "http" : "https"}://${host}`;
}
