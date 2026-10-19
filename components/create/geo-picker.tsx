"use client";

import { Field, RadioRow, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ChipButton } from "@/components/ui/pill";
import { formatRadius } from "@/lib/format";
import { getCitiesWithPosts, viewerLocation } from "@/lib/mock";
import type { GeoMode, GeoRadius } from "@/lib/types";

/**
 * How the author pins the place down. Three mutually exclusive modes, each
 * writing into the same draft, so the form hands over one value and gets one
 * value back.
 */
export interface GeoDraft {
  mode: GeoMode;
  radius_m: GeoRadius;
  /** Free text while the map area picker is not built yet. */
  meeting_point: string;
  city: string;
}

export const initialGeo: GeoDraft = {
  mode: "radius",
  radius_m: 2000,
  meeting_point: "",
  city: "",
};

/** Focus targets, so the form can jump to whatever is missing. */
export const GEO_FIELD_IDS = {
  radius: "create-geo-radius",
  meetingPoint: "create-geo-meeting-point",
  city: "create-geo-city",
} as const;

const radii: readonly GeoRadius[] = [500, 1000, 2000, 5000, 10000];

function toMode(raw: string): GeoMode {
  if (raw === "area") return "area";
  if (raw === "city") return "city";
  return "radius";
}

/** The id to move focus to when the place is incomplete. */
export function geoFocusId(geo: GeoDraft): string {
  if (geo.mode === "area") return GEO_FIELD_IDS.meetingPoint;
  if (geo.mode === "city") return GEO_FIELD_IDS.city;
  return GEO_FIELD_IDS.radius;
}

/** Null when the place is complete. Says what to do, not what went wrong. */
export function geoError(geo: GeoDraft): string | null {
  if (geo.mode === "area" && !geo.meeting_point.trim()) {
    return "Впиши место встречи словами — карты пока нет.";
  }
  if (geo.mode === "city" && !geo.city.trim()) {
    return "Укажи город, в котором всё пройдёт.";
  }
  return null;
}

/** One line for a card or a summary: where this idea happens. */
export function describeGeo(geo: GeoDraft): string {
  switch (geo.mode) {
    case "radius":
      return `В радиусе ${formatRadius(geo.radius_m)} от ${viewerLocation.label}`;
    case "area":
      return geo.meeting_point.trim();
    case "city":
      return geo.city.trim();
  }
}

export function GeoPicker({
  value,
  onChange,
  error,
}: {
  value: GeoDraft;
  onChange: (next: GeoDraft) => void;
  error?: string;
}) {
  const cities = getCitiesWithPosts();

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Как указать место" className="space-y-2">
        <RadioRow
          name="create-geo-mode"
          value="radius"
          checked={value.mode === "radius"}
          onChange={(raw) => onChange({ ...value, mode: toMode(raw) })}
          label="Радиус вокруг меня"
          description="Идею увидят те, кто рядом."
          icon="place"
        />
        <RadioRow
          name="create-geo-mode"
          value="area"
          checked={value.mode === "area"}
          onChange={(raw) => onChange({ ...value, mode: toMode(raw) })}
          label="Область на карте"
          description="Участок, внутри которого будет место встречи."
          icon="pin"
        />
        <RadioRow
          name="create-geo-mode"
          value="city"
          checked={value.mode === "city"}
          onChange={(raw) => onChange({ ...value, mode: toMode(raw) })}
          label="Указать город"
          description="Для всего, что не привязано к одной точке."
          icon="globe"
        />
      </div>

      {value.mode === "radius" ? (
        // Без плашки под этим блоком: чипы радиуса сами на заливке `bg-sunken`,
        // на второй такой же заливке их не видно. Метка места, чипы и подсказка
        // лежат прямо на фоне — так же, как в фильтрах поиска.
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-[14px] text-ink-soft">
            <Icon name="place" size={14} className="shrink-0" />
            Ты здесь: {viewerLocation.label}
          </p>
          <div
            id={GEO_FIELD_IDS.radius}
            tabIndex={-1}
            role="group"
            aria-label="Радиус"
            className="flex flex-wrap gap-2"
          >
            {radii.map((metres) => (
              <ChipButton
                key={metres}
                active={value.radius_m === metres}
                onClick={() => onChange({ ...value, radius_m: metres })}
              >
                {formatRadius(metres)}
              </ChipButton>
            ))}
          </div>
          <p className="text-[13px] text-ink-soft">
            Идею ищут от твоего местоположения. Точный адрес остаётся только у тебя.
          </p>
        </div>
      ) : null}

      {value.mode === "area" ? (
        <div className="space-y-3">
          {/* Заглушка карты — заливка без рамки: пунктир в приложении больше
              не встречается, а линия вокруг весит больше, чем сама заливка. */}
          <div className="relative flex h-36 flex-col items-center justify-center rounded-field bg-sunken px-4 text-center">
            <span aria-hidden className="absolute inset-x-8 top-1/2 h-px bg-line" />
            <span aria-hidden className="absolute inset-y-6 left-1/2 w-px bg-line" />
            <span
              aria-hidden
              className="relative flex size-9 items-center justify-center rounded-full bg-sunken"
            >
              <span className="size-2.5 rounded-full bg-signal" />
            </span>
            <p className="relative mt-2.5 text-[14px]">{viewerLocation.label}</p>
            <p className="relative mt-0.5 text-[13px] text-ink-soft">
              Карты пока нет, только твоя точка
            </p>
          </div>

          <p className="text-[13px] text-ink-soft">
            Выделить область на карте можно будет, когда карту встроим. Пока опиши место встречи
            словами.
          </p>

          <Field
            label="Место встречи"
            required
            htmlFor={GEO_FIELD_IDS.meetingPoint}
            hint="Так точно, чтобы тебя нашли."
            error={error}
          >
            <TextInput
              id={GEO_FIELD_IDS.meetingPoint}
              value={value.meeting_point}
              onChange={(event) => onChange({ ...value, meeting_point: event.target.value })}
              placeholder="Admiralbrücke, лестница у южного берега"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
            />
          </Field>
        </div>
      ) : null}

      {value.mode === "city" ? (
        <div className="space-y-3">
          <Field label="Город" required htmlFor={GEO_FIELD_IDS.city} error={error}>
            <TextInput
              id={GEO_FIELD_IDS.city}
              value={value.city}
              onChange={(event) => onChange({ ...value, city: event.target.value })}
              placeholder="Берлин"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
            />
          </Field>

          {cities.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-ink-faint">Здесь уже есть идеи</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Выбрать город">
                {cities.map((city) => (
                  <ChipButton
                    key={city}
                    active={value.city.trim().toLowerCase() === city.toLowerCase()}
                    onClick={() => onChange({ ...value, city })}
                  >
                    {city}
                  </ChipButton>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
