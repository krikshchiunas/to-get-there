import type { MetadataRoute } from "next";

/**
 * Приложение закрыто входом: индексировать в нём нечего, а профили и идеи
 * студентов поисковикам видеть не нужно. Открыты только документы —
 * Impressum и политику конфиденциальности ищут.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/legal", "/auth/login", "/auth/signup"], disallow: "/" }],
  };
}
