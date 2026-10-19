"use client";

import { useEffect, useState } from "react";
import { formatRelative, formatStamp } from "@/lib/format";
import type { Timestamp } from "@/lib/types";

/**
 * Relative time without hydration drift: the server and the first client
 * render both show the absolute stamp, then the client swaps in
 * "через 25 мин." and keeps it fresh.
 */
export function TimeFromNow({
  value,
  className = "",
  mode = "relative",
}: {
  value: Timestamp;
  className?: string;
  mode?: "relative" | "stamp";
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const reference = now ?? new Date(value);
  const text =
    mode === "relative" && now ? formatRelative(value, now) : formatStamp(value, reference);

  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
