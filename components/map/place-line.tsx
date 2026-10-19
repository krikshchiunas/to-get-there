"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Place } from "@/lib/place";

/** Откуда считается радиус — и как сделать точнее. */
export function PlaceLine({
  place,
  onLocate,
  onResetToCampus,
  locating,
  locateError,
}: {
  place: Place;
  onLocate: () => void;
  onResetToCampus: () => void;
  locating: boolean;
  locateError: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="flex items-center gap-1.5 text-[14px] text-ink-soft">
          <Icon name="place" size={14} className="shrink-0" />
          Отсчёт: {place.label}
        </p>
        {place.source === "campus" ? (
          <Button type="button" variant="quiet" size="sm" disabled={locating} onClick={onLocate}>
            {locating ? "Определяем…" : "Определить точнее"}
          </Button>
        ) : (
          <Button type="button" variant="quiet" size="sm" onClick={onResetToCampus}>
            От кампуса
          </Button>
        )}
      </div>
      {locateError ? (
        <p className="text-[13px] text-ink-soft" role="status">
          {locateError}
        </p>
      ) : null}
    </div>
  );
}
