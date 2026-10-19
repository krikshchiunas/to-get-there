"use client";

import dynamic from "next/dynamic";
import { Field, RadioRow, TextInput } from "@/components/ui/field";
import { ChipButton } from "@/components/ui/pill";
import { formatRadius } from "@/lib/format";
import { AREA_RADIUS_M, type Place } from "@/lib/place";
import type { GeoMode, GeoRadius } from "@/lib/types";
import type { LatLng } from "@/components/map/map-view";
import { PlaceLine } from "@/components/map/place-line";

// Leaflet живёт только в браузере; пока грузится — заливка того же размера.
const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-56 rounded-field bg-sunken" aria-hidden />,
});

export { AREA_RADIUS_M };

/**
 * How the author pins the place down. Three mutually exclusive modes, each
 * writing into the same draft, so the form hands over one value and gets one
 * value back.
 */
export interface GeoDraft {
  mode: GeoMode;
  radius_m: GeoRadius;
  /** Область: центр, выбранный на карте. */
  point: LatLng | null;
  /** Как найти друг друга на месте — словами. */
  meeting_point: string;
  city: string;
}

export const initialGeo: GeoDraft = {
  mode: "radius",
  radius_m: 2000,
  point: null,
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
  if (geo.mode === "area" && !geo.point) {
    return "Сдвинь карту так, чтобы булавка стояла на месте встречи.";
  }
  if (geo.mode === "area" && !geo.meeting_point.trim()) {
    return "Опиши словами, как найти друг друга на месте.";
  }
  if (geo.mode === "city" && !geo.city.trim()) {
    return "Укажи город, в котором всё пройдёт.";
  }
  return null;
}

/** One line for a card or a summary: where this idea happens. */
export function describeGeo(geo: GeoDraft, place: Place): string {
  switch (geo.mode) {
    case "radius":
      return `В радиусе ${formatRadius(geo.radius_m)}: ${place.label.toLowerCase()}`;
    case "area":
      return geo.meeting_point.trim();
    case "city":
      return geo.city.trim();
  }
}

export function GeoPicker({
  cities,
  value,
  onChange,
  error,
  place,
  onLocate,
  onResetToCampus,
  locating,
  locateError,
}: {
  /** Города, где сейчас есть идеи. */
  cities: string[];
  value: GeoDraft;
  onChange: (next: GeoDraft) => void;
  error?: string;
  /** Точка отсчёта: кампус или, если разрешено, где человек сейчас. */
  place: Place;
  onLocate: () => void;
  onResetToCampus: () => void;
  locating: boolean;
  locateError: string | null;
}) {
  function setMode(raw: string) {
    const mode = toMode(raw);
    // В область — начать с точки отсчёта, а не с пустой карты.
    onChange({ ...value, mode, point: mode === "area" && !value.point ? { lat: place.lat, lng: place.lng } : value.point });
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Как указать место" className="space-y-2">
        <RadioRow
          name="create-geo-mode"
          value="radius"
          checked={value.mode === "radius"}
          onChange={setMode}
          label="Радиус вокруг меня"
          description="Идею увидят те, кто рядом."
          icon="place"
        />
        <RadioRow
          name="create-geo-mode"
          value="area"
          checked={value.mode === "area"}
          onChange={setMode}
          label="Область на карте"
          description="Участок, внутри которого будет место встречи."
          icon="pin"
        />
        <RadioRow
          name="create-geo-mode"
          value="city"
          checked={value.mode === "city"}
          onChange={setMode}
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
          <PlaceLine
            place={place}
            onLocate={onLocate}
            onResetToCampus={onResetToCampus}
            locating={locating}
            locateError={locateError}
          />
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
          <MapView
            center={place}
            radiusM={value.radius_m}
            zoom={zoomForRadius(value.radius_m)}
            label={`Радиус ${formatRadius(value.radius_m)} вокруг: ${place.label}`}
          />
          <p className="text-[13px] text-ink-soft">
            Другие видят только город и радиус. Точка хранится с точностью около километра, адреса
            в ней нет.
          </p>
        </div>
      ) : null}

      {value.mode === "area" ? (
        <div className="space-y-3">
          <MapView
            center={value.point ?? place}
            radiusM={AREA_RADIUS_M}
            zoom={16}
            label="Карта: сдвинь её так, чтобы булавка стояла на месте встречи. Стрелки двигают карту."
            onPick={(point) => onChange({ ...value, point })}
          />

          <p className="text-[13px] text-ink-soft">
            Сдвинь карту — булавка в центре и есть место встречи. Участники увидят круг около
            {" "}{AREA_RADIUS_M} м вокруг неё.
          </p>

          <Field
            label="Место встречи"
            required
            htmlFor={GEO_FIELD_IDS.meetingPoint}
            hint="Как найти друг друга на месте."
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

/** Масштаб, при котором круг радиуса помещается в карту. */
function zoomForRadius(metres: number): number {
  if (metres <= 500) return 15;
  if (metres <= 1000) return 14;
  if (metres <= 2000) return 13;
  if (metres <= 5000) return 12;
  return 11;
}
