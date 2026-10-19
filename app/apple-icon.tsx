import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Иконка на главном экране iPhone: та же марка, что app/icon.svg, растром. */
export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={180} rounded={false} />, size);
}
