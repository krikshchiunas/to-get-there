"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { Place } from "@/lib/place";
import {
  dateErrorOf,
  draftFrom,
  isDraftEmpty,
  placeErrorOf,
  timeErrorOf,
  toFilters,
  type FilterDraft,
} from "@/lib/search-draft";
import { emptyFilters, type SearchFilters } from "@/lib/types";
import { FilterDate } from "./filter-date";
import { FilterPlace } from "./filter-place";
import { FilterTime } from "./filter-time";

/**
 * Лист «Фильтры»: дата, время суток и место. Правки живут в черновике и
 * попадают в поиск только по «Применить фильтры» (правила — в
 * lib/search-draft.ts).
 */
export function FilterSheet({
  open,
  filters,
  cities,
  onClose,
  onApply,
  place,
  onLocate,
  onResetToCampus,
  locating,
  locateError,
}: {
  open: boolean;
  filters: SearchFilters;
  /** Города, где сейчас есть идеи. Загружает серверная страница. */
  cities: string[];
  onClose: () => void;
  onApply: (next: SearchFilters) => void;
  /** Откуда считать радиус (lib/use-place.ts). */
  place: Place;
  onLocate: () => void;
  onResetToCampus: () => void;
  locating: boolean;
  locateError: string | null;
}) {
  const [draft, setDraft] = useState<FilterDraft>(() => draftFrom(filters));

  // Лист всегда открывается с того, по чему сейчас идёт поиск.
  useEffect(() => {
    if (open) setDraft(draftFrom(filters));
  }, [open, filters]);

  const patch = (next: Partial<FilterDraft>) => setDraft((current) => ({ ...current, ...next }));

  const dateError = dateErrorOf(draft);
  const timeError = timeErrorOf(draft);
  const placeError = placeErrorOf(draft);
  const blocked = dateError !== null || timeError !== null || placeError !== null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Фильтры"
      footer={
        <div className="flex items-center gap-2">
          <Button
            variant="quiet"
            size="lg"
            onClick={() => setDraft(draftFrom(emptyFilters))}
            disabled={isDraftEmpty(draft)}
          >
            Сбросить
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={blocked}
            onClick={() => onApply(toFilters(draft, filters))}
          >
            Применить фильтры
          </Button>
        </div>
      }
    >
      {/* Секции разделены линией и воздухом, а не рамкой вокруг каждой:
          три обведённые группы в одном листе читаются как три панели. */}
      <div>
        <FilterDate draft={draft} error={dateError} patch={patch} />
        <FilterTime draft={draft} error={timeError} patch={patch} />
        <FilterPlace
          draft={draft}
          error={placeError}
          patch={patch}
          cities={cities}
          place={place}
          onLocate={onLocate}
          onResetToCampus={onResetToCampus}
          locating={locating}
          locateError={locateError}
        />
      </div>
    </Sheet>
  );
}
