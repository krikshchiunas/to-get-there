"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, RadioRow, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ChipButton } from "@/components/ui/pill";
import { Sheet } from "@/components/ui/sheet";
import { formatMinutesOfDay, formatRadius } from "@/lib/format";
import { PlaceLine } from "@/components/map/place-line";
import type { Place } from "@/lib/place";
import { emptyFilters, type GeoMode, type GeoRadius, type SearchFilters } from "@/lib/types";

/**
 * Date, time of day and place. Everything the sheet collects is edited in a
 * draft and only written back on "Применить фильтры", so a half-typed date
 * never empties the result list behind the sheet.
 *
 * There is deliberately no verification filter: a checked identity grants no
 * privileges anywhere in the app, so it may not sort or hide results either.
 */

type DateMode = "any" | "day" | "range";
type PlaceMode = "any" | GeoMode;

const radii: readonly GeoRadius[] = [500, 1000, 2000, 5000, 10000];

/** Quick windows beside the manual input, in minutes from midnight. */
const presets: ReadonlyArray<{ id: string; label: string; from: number; to: number }> = [
  { id: "morning", label: "Утро", from: 6 * 60, to: 12 * 60 },
  { id: "afternoon", label: "День", from: 12 * 60, to: 18 * 60 },
  { id: "evening", label: "Вечер", from: 18 * 60, to: 23 * 60 },
];

const FIELD = {
  day: "filter-date-day",
  dateFrom: "filter-date-from",
  dateTo: "filter-date-to",
  timeFrom: "filter-time-from",
  timeTo: "filter-time-to",
} as const;

interface Draft {
  dateMode: DateMode;
  day: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  placeMode: PlaceMode;
  radius: GeoRadius;
  city: string;
}

function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function toPlaceMode(raw: string): PlaceMode {
  if (raw === "radius" || raw === "area" || raw === "city") return raw;
  return "any";
}

function draftFrom(filters: SearchFilters): Draft {
  const singleDay = filters.date_from !== null && filters.date_from === filters.date_to;
  const dateMode: DateMode =
    filters.date_from === null && filters.date_to === null ? "any" : singleDay ? "day" : "range";
  const window = filters.time_window;

  return {
    dateMode,
    day: dateMode === "day" ? (filters.date_from ?? "") : "",
    dateFrom: dateMode === "range" ? (filters.date_from ?? "") : "",
    dateTo: dateMode === "range" ? (filters.date_to ?? "") : "",
    timeFrom: window ? formatMinutesOfDay(window.from_minutes) : "",
    timeTo: window ? formatMinutesOfDay(window.to_minutes) : "",
    placeMode: filters.geo_mode ?? "any",
    radius: filters.geo_radius_m ?? 2000,
    city: filters.geo_city ?? "",
  };
}

function dateErrorOf(draft: Draft): string | null {
  if (draft.dateMode !== "range") return null;
  if (!draft.dateFrom || !draft.dateTo) return null;
  if (draft.dateTo < draft.dateFrom) {
    return "Дата «по» раньше даты «с». Сдвинь одну из них, чтобы диапазон шёл вперёд.";
  }
  return null;
}

function timeErrorOf(draft: Draft): string | null {
  const from = toMinutes(draft.timeFrom);
  const to = toMinutes(draft.timeTo);
  if (!draft.timeFrom && !draft.timeTo) return null;
  if (from === null || to === null) return "Заполни оба конца окна: с какого и по какое время.";
  if (to <= from) return "Окно пустое: время «по» должно быть позже, чем «с».";
  return null;
}

function placeErrorOf(draft: Draft): string | null {
  if (draft.placeMode === "city" && !draft.city) return "Выбери город из списка.";
  return null;
}

/** The draft written back into the filters the screen searches with. */
function toFilters(draft: Draft, base: SearchFilters): SearchFilters {
  const timeFrom = toMinutes(draft.timeFrom);
  const timeTo = toMinutes(draft.timeTo);

  const dates: Pick<SearchFilters, "date_from" | "date_to"> =
    draft.dateMode === "day"
      ? { date_from: draft.day || null, date_to: draft.day || null }
      : draft.dateMode === "range"
        ? { date_from: draft.dateFrom || null, date_to: draft.dateTo || null }
        : { date_from: null, date_to: null };

  return {
    ...base,
    ...dates,
    time_window:
      timeFrom !== null && timeTo !== null
        ? { from_minutes: timeFrom, to_minutes: timeTo }
        : null,
    geo_mode: draft.placeMode === "any" ? null : draft.placeMode,
    geo_radius_m: draft.placeMode === "radius" ? draft.radius : null,
    geo_city: draft.placeMode === "city" && draft.city ? draft.city : null,
  };
}

/** How many of this sheet's filters are set — the count on the chip. */
export function activeFilterCount(filters: SearchFilters): number {
  let count = 0;
  if (filters.date_from !== null || filters.date_to !== null) count += 1;
  if (filters.time_window !== null) count += 1;
  if (filters.geo_mode !== null) count += 1;
  return count;
}

function SectionError({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[12px] leading-snug text-heat" role="alert">
      <Icon name="close" size={12} className="mt-0.5 shrink-0" />
      {children}
    </p>
  );
}

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
  const [draft, setDraft] = useState<Draft>(() => draftFrom(filters));

  // Opening the sheet always starts from what is actually being searched.
  useEffect(() => {
    if (open) setDraft(draftFrom(filters));
  }, [open, filters]);

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  const dateError = dateErrorOf(draft);
  const timeError = timeErrorOf(draft);
  const placeError = placeErrorOf(draft);
  const blocked = dateError !== null || timeError !== null || placeError !== null;

  const windowFrom = toMinutes(draft.timeFrom);
  const windowTo = toMinutes(draft.timeTo);
  const activePreset = presets.find(
    (preset) => windowFrom === preset.from && windowTo === preset.to,
  );

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
            disabled={
              draft.dateMode === "any" &&
              !draft.timeFrom &&
              !draft.timeTo &&
              draft.placeMode === "any"
            }
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
        <section aria-labelledby="filter-date-heading" className="space-y-3 pb-6">
          <h3 id="filter-date-heading" className="text-[13px] font-medium text-ink-faint">
            Дата
          </h3>

          <div role="group" aria-labelledby="filter-date-heading" className="flex flex-wrap gap-2">
            <ChipButton
              active={draft.dateMode === "any"}
              onClick={() => patch({ dateMode: "any" })}
            >
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
                    aria-invalid={dateError !== null ? true : undefined}
                    onChange={(event) => patch({ dateFrom: event.target.value })}
                  />
                </Field>
                <Field label="По" required htmlFor={FIELD.dateTo}>
                  <TextInput
                    id={FIELD.dateTo}
                    type="date"
                    value={draft.dateTo}
                    min={draft.dateFrom || undefined}
                    aria-invalid={dateError !== null ? true : undefined}
                    onChange={(event) => patch({ dateTo: event.target.value })}
                  />
                </Field>
              </div>
              {dateError ? <SectionError>{dateError}</SectionError> : null}
            </div>
          ) : null}
        </section>

        <section
          aria-labelledby="filter-time-heading"
          className="space-y-3 border-t border-line py-6"
        >
          <h3 id="filter-time-heading" className="text-[13px] font-medium text-ink-faint">
            Время суток
          </h3>

          <div role="group" aria-label="Готовые окна времени" className="flex flex-wrap gap-2">
            {presets.map((preset) => (
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
                aria-invalid={timeError !== null ? true : undefined}
                onChange={(event) => patch({ timeFrom: event.target.value })}
              />
            </Field>
            <Field label="Конец окна" required htmlFor={FIELD.timeTo}>
              <TextInput
                id={FIELD.timeTo}
                type="time"
                value={draft.timeTo}
                aria-invalid={timeError !== null ? true : undefined}
                onChange={(event) => patch({ timeTo: event.target.value })}
              />
            </Field>
          </div>

          {timeError ? (
            <SectionError>{timeError}</SectionError>
          ) : windowFrom !== null && windowTo !== null ? (
            <p className="u-tnum text-[13px] text-ink-soft">
              Идеи, которые начинаются между {formatMinutesOfDay(windowFrom)} и{" "}
              {formatMinutesOfDay(windowTo)}.
            </p>
          ) : (
            <p className="text-[13px] text-ink-soft">
              Без окна в результатах остаётся любое время дня.
            </p>
          )}
        </section>

        <section
          aria-labelledby="filter-place-heading"
          className="space-y-3 border-t border-line pt-6"
        >
          <h3 id="filter-place-heading" className="text-[13px] font-medium text-ink-faint">
            Где
          </h3>

          <div role="radiogroup" aria-labelledby="filter-place-heading" className="space-y-2">
            <RadioRow
              name="filter-place-mode"
              value="any"
              checked={draft.placeMode === "any"}
              onChange={(raw) => patch({ placeMode: toPlaceMode(raw) })}
              label="Везде"
              description="Идеи из всех городов."
              icon="globe"
            />
            <RadioRow
              name="filter-place-mode"
              value="radius"
              checked={draft.placeMode === "radius"}
              onChange={(raw) => patch({ placeMode: toPlaceMode(raw) })}
              label="Радиус вокруг меня"
              description="Считается от твоего места."
              icon="place"
            />
            <RadioRow
              name="filter-place-mode"
              value="area"
              checked={draft.placeMode === "area"}
              onChange={(raw) => patch({ placeMode: toPlaceMode(raw) })}
              label="Область на карте"
              description="Появится вместе с картами."
              icon="pin"
            />
            <RadioRow
              name="filter-place-mode"
              value="city"
              checked={draft.placeMode === "city"}
              onChange={(raw) => patch({ placeMode: toPlaceMode(raw) })}
              label="Указать город"
              description="Города, где идеи уже есть."
              icon="globe"
            />
          </div>

          {draft.placeMode === "radius" ? (
            // Без плашки под этим блоком: чипы радиуса сами на заливке
            // `bg-sunken`, на второй такой же заливке их не видно.
            <div className="space-y-2.5">
              <PlaceLine
                place={place}
                onLocate={onLocate}
                onResetToCampus={onResetToCampus}
                locating={locating}
                locateError={locateError}
              />
              <div role="group" aria-label="Радиус" className="flex flex-wrap gap-2">
                {radii.map((metres) => (
                  <ChipButton
                    key={metres}
                    active={draft.radius === metres}
                    onClick={() => patch({ radius: metres })}
                  >
                    {formatRadius(metres)}
                  </ChipButton>
                ))}
              </div>
              <p className="text-[13px] text-ink-soft">
                В результатах останутся идеи с точкой на карте внутри этого радиуса.
              </p>
            </div>
          ) : null}

          {draft.placeMode === "area" ? (
            <div className="space-y-1.5 rounded-field bg-sunken p-3.5">
              <p className="flex items-center gap-1.5 text-[14px]">
                <Icon name="pin" size={14} className="shrink-0 text-ink-soft" />
                Выбор области появится вместе с картами
              </p>
              <p className="text-[13px] leading-[1.4] text-ink-soft">
                Карты в приложении пока нет, рисовать область не на чем — этот режим начнёт
                работать вместе с их интеграцией. Сейчас он результаты не сужает: возьми радиус
                вокруг себя или укажи город.
              </p>
            </div>
          ) : null}

          {draft.placeMode === "city" ? (
            <div className="space-y-2">
              <div role="group" aria-label="Город" className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <ChipButton
                    key={city}
                    active={draft.city === city}
                    onClick={() => patch({ city: draft.city === city ? "" : city })}
                  >
                    {city}
                  </ChipButton>
                ))}
              </div>
              {placeError ? (
                <SectionError>{placeError}</SectionError>
              ) : (
                <p className="text-[13px] text-ink-soft">
                  Города в списке — те, где прямо сейчас есть идеи.
                </p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </Sheet>
  );
}
