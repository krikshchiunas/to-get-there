"use client";

import { Field, TextInput } from "@/components/ui/field";
import { ChipButton } from "@/components/ui/pill";
import { formatMinutesOfDay } from "@/lib/format";
import { TIME_PRESETS, toMinutes, type FilterDraft } from "@/lib/search-draft";
import { SectionError } from "./section-error";

const FIELD = {
  timeFrom: "filter-time-from",
  timeTo: "filter-time-to",
} as const;

/** Время суток: готовые окна или своё. */
export function FilterTime({
  draft,
  error,
  patch,
}: {
  draft: FilterDraft;
  error: string | null;
  patch: (next: Partial<FilterDraft>) => void;
}) {
  const windowFrom = toMinutes(draft.timeFrom);
  const windowTo = toMinutes(draft.timeTo);
  const activePreset = TIME_PRESETS.find((preset) => windowFrom === preset.from && windowTo === preset.to);

  return (
    <section aria-labelledby="filter-time-heading" className="space-y-3 border-t border-line py-6">
      <h3 id="filter-time-heading" className="text-[13px] font-medium text-ink-faint">
        Время суток
      </h3>

      <div role="group" aria-label="Готовые окна времени" className="flex flex-wrap gap-2">
        {TIME_PRESETS.map((preset) => (
          <ChipButton
            key={preset.id}
            icon="clock"
            active={activePreset?.id === preset.id}
            onClick={() =>
              patch({
                timeFrom: formatMinutesOfDay(preset.from),
                timeTo: formatMinutesOfDay(preset.to),
              })
            }
          >
            {preset.label}
          </ChipButton>
        ))}
        {draft.timeFrom || draft.timeTo ? (
          <ChipButton icon="close" onClick={() => patch({ timeFrom: "", timeTo: "" })}>
            Убрать время
          </ChipButton>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Начало окна" required htmlFor={FIELD.timeFrom}>
          <TextInput
            id={FIELD.timeFrom}
            type="time"
            value={draft.timeFrom}
            aria-invalid={error !== null ? true : undefined}
            onChange={(event) => patch({ timeFrom: event.target.value })}
          />
        </Field>
        <Field label="Конец окна" required htmlFor={FIELD.timeTo}>
          <TextInput
            id={FIELD.timeTo}
            type="time"
            value={draft.timeTo}
            aria-invalid={error !== null ? true : undefined}
            onChange={(event) => patch({ timeTo: event.target.value })}
          />
        </Field>
      </div>

      {error ? (
        <SectionError>{error}</SectionError>
      ) : windowFrom !== null && windowTo !== null ? (
        <p className="u-tnum text-[13px] text-ink-soft">
          Идеи, которые начинаются между {formatMinutesOfDay(windowFrom)} и {formatMinutesOfDay(windowTo)}.
        </p>
      ) : (
        <p className="text-[13px] text-ink-soft">Без окна в результатах остаётся любое время дня.</p>
      )}
    </section>
  );
}
