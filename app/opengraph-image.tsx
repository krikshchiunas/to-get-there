import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand/brand-mark";

export const alt = "To Get There — найди, с кем сделать то, что задумал";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Превью ссылки в мессенджерах. Без шрифта приложения: системный sans
 * у ImageResponse справляется с кириллицей, а лишний файл шрифта в
 * сборке ради картинки не нужен.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#ffffff",
          color: "#101418",
        }}
      >
        <BrandMark size={112} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: -1.5 }}>To Get There</div>
          <div style={{ marginTop: 18, fontSize: 36, color: "#5b6472", lineHeight: 1.3 }}>
            Напиши, что хочешь сделать. Кто с тобой — соберётся в чате этой идеи.
          </div>
        </div>
        <div style={{ fontSize: 28, color: "#2f3bee" }}>Для студентов университетов Германии</div>
      </div>
    ),
    size,
  );
}
