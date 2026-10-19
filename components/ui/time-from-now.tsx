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

  // В относительном режиме до гидратации не рисуем ничего: на сервере
  // «через сколько» посчитать нечем, а подставлять туда абсолютное время
  // нельзя — рядом почти всегда стоит оно же, и получается дубль.
  const text = now
    ? mode === "relative"
      ? formatRelative(value, now)
      : formatStamp(value, now)
    : mode === "relative"
      ? ""
      : formatStamp(value, new Date(value));

  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
