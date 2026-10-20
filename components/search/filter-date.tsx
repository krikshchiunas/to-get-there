"use client";

import { Field, TextInput } from "@/components/ui/field";
import { ChipButton } from "@/components/ui/pill";
import type { FilterDraft } from "@/lib/search-draft";
import { SectionError } from "./section-error";

const FIELD = {
  day: "filter-date-day",
  dateFrom: "filter-date-from",
  dateTo: "filter-date-to",
} as const;

/** Дата: любая, один день или диапазон. */
export function FilterDate({
  draft,
  error,
  patch,
}: {
  draft: FilterDraft;
  error: string | null;
  patch: (next: Partial<FilterDraft>) => void;
}) {
  return (
    <section aria-labelledby="filter-date-heading" className="space-y-3 pb-6">
      <h3 id="filter-date-heading" className="text-[13px] font-medium text-ink-faint">
        Дата
      </h3>

      <div role="group" aria-labelledby="filter-date-heading" className="flex flex-wrap gap-2">
        <ChipButton active={draft.dateMode === "any"} onClick={() => patch({ dateMode: "any" })}>
          Любая
        </ChipButton>
        <ChipButton
          icon="calendar"
          active={draft.dateMode === "day"}
          onClick={() => patch({ dateMode: "day" })}
        >
          Один день
        </ChipButton>
        <ChipButton
          icon="calendar"
          active={draft.dateMode === "range"}
          onClick={() => patch({ dateMode: "range" })}
        >
          Диапазон
        </ChipButton>
      </div>

      {draft.dateMode === "day" ? (
        <Field label="День" required htmlFor={FIELD.day}>
          <TextInput
            id={FIELD.day}
            type="date"
            value={draft.day}
            onChange={(event) => patch({ day: event.target.value })}
          />
        </Field>
      ) : null}

      {draft.dateMode === "range" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="С" required htmlFor={FIELD.dateFrom}>
              <TextInput
                id={FIELD.dateFrom}
                type="date"
                value={draft.dateFrom}
                aria-invalid={error !== null ? true : undefined}
                onChange={(event) => patch({ dateFrom: event.target.value })}
              />
            </Field>
            <Field label="По" required htmlFor={FIELD.dateTo}>
              <TextInput
                id={FIELD.dateTo}
                type="date"
                value={draft.dateTo}
                min={draft.dateFrom || undefined}
                aria-invalid={error !== null ? true : undefined}
                onChange={(event) => patch({ dateTo: event.target.value })}
              />
            </Field>
          </div>
          {error ? <SectionError>{error}</SectionError> : null}
        </div>
      ) : null}
    </section>
  );
}
