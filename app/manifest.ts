import type { MetadataRoute } from "next";

/**
 * Установка на главный экран телефона (PWA). Иконки рисует сам Next
 * (app/icon.svg, app/apple-icon.tsx), цвета — фон и акцент из globals.css.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "To Get There",
    short_name: "To Get There",
    description: "Напиши, что хочешь сделать. Кто с тобой — соберётся в чате этой идеи.",
    lang: "ru",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2f3bee",
    categories: ["social", "education", "lifestyle"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180", purpose: "any" },
      { src: "/icon-maskable", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
