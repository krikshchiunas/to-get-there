/**
 * Марка To Get There для растровых иконок и превью (next/og). Геометрия
 * повторяет app/icon.svg: точка-автор на линии времени и две строки
 * расписания. Только инлайновые стили — ImageResponse не знает Tailwind.
 */
export function BrandMark({
  size,
  rounded = true,
  padding = 0,
}: {
  size: number;
  rounded?: boolean;
  /** Доля размера под безопасное поле (для maskable). */
  padding?: number;
}) {
  const unit = (size * (1 - padding * 2)) / 32;
  const px = (value: number) => `${value * unit}px`;
  const ink = "#fcfcfe";

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2f3bee",
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <div style={{ position: "relative", width: px(32), height: px(32), display: "flex" }}>
        <div style={{ position: "absolute", left: px(10), top: px(6.5), width: px(2), height: px(19), borderRadius: px(1), background: ink, opacity: 0.55 }} />
        <div style={{ position: "absolute", left: px(7.9), top: px(8.9), width: px(6.2), height: px(6.2), borderRadius: px(3.1), background: ink }} />
        <div style={{ position: "absolute", left: px(9), top: px(18), width: px(4), height: px(4), borderRadius: px(2), background: ink, opacity: 0.6 }} />
        <div style={{ position: "absolute", left: px(17), top: px(11), width: px(9), height: px(2), borderRadius: px(1), background: ink }} />
        <div style={{ position: "absolute", left: px(17), top: px(19), width: px(6.5), height: px(2), borderRadius: px(1), background: ink, opacity: 0.6 }} />
      </div>
    </div>
  );
}
