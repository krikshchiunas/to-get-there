import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand/brand-mark";

/**
 * Maskable-иконка для Android: марка в безопасной зоне (центральные 80%),
 * фон до краёв — система сама скругляет или обрезает по своей маске.
 */
export function GET() {
  return new ImageResponse(<BrandMark size={512} rounded={false} padding={0.2} />, { width: 512, height: 512 });
}
