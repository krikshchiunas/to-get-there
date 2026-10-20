"use client";

import dynamic from "next/dynamic";
import { RadioRow } from "@/components/ui/field";
import { ChipButton } from "@/components/ui/pill";
import { PlaceLine } from "@/components/map/place-line";
import { formatRadius } from "@/lib/format";
import { zoomForRadius, type Place } from "@/lib/place";
import { SEARCH_RADII, toPlaceMode, type FilterDraft } from "@/lib/search-draft";
import { SectionError } from "./section-error";

// Leaflet живёт только в браузере; пока грузится — заливка того же размера.
const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-56 rounded-field bg-sunken" aria-hidden />,
});

/** Где: везде, вокруг меня, в круге на карте или в городе. */
export function FilterPlace({
  draft,
  error,
  patch,
  cities,
  place,
  onLocate,
  onResetToCampus,
  locating,
  locateError,
}: {
  draft: FilterDraft;
  error: string | null;
  patch: (next: Partial<FilterDraft>) => void;
  /** Города, где сейчас есть идеи. */
  cities: string[];
  /** Откуда считать «вокруг меня» и где открыть карту. */
  place: Place;
  onLocate: () => void;
  onResetToCampus: () => void;
  locating: boolean;
  locateError: string | null;
}) {
  function setMode(raw: string) {
    const placeMode = toPlaceMode(raw);
    // Карта открывается там, где человек, а не в пустом месте.
    if (placeMode === "area" && !draft.point) {
      patch({ placeMode, point: { lat: place.lat, lng: place.lng } });
      return;
    }
    patch({ placeMode });
  }

  const radiusChips = (
    <div role="group" aria-label="Радиус" className="flex flex-wrap gap-2">
      {SEARCH_RADII.map((metres) => (
        <ChipButton key={metres} active={draft.radius === metres} onClick={() => patch({ radius: metres })}>
          {formatRadius(metres)}
        </ChipButton>
      ))}
    </div>
  );

  return (
    <section aria-labelledby="filter-place-heading" className="space-y-3 border-t border-line pt-6">
      <h3 id="filter-place-heading" className="text-[13px] font-medium text-ink-faint">
        Где
      </h3>

      <div role="radiogroup" aria-labelledby="filter-place-heading" className="space-y-2">
        <RadioRow
          name="filter-place-mode"
          value="any"
          checked={draft.placeMode === "any"}
          onChange={setMode}
          label="Везде"
          description="Идеи из всех городов."
          icon="globe"
        />
        <RadioRow
          name="filter-place-mode"
          value="radius"
          checked={draft.placeMode === "radius"}
          onChange={setMode}
          label="Радиус вокруг меня"
          description="Считается от твоего места."
          icon="place"
        />
        <RadioRow
          name="filter-place-mode"
          value="area"
          checked={draft.placeMode === "area"}
          onChange={setMode}
          label="Область на карте"
          description="Круг вокруг точки, которую выберешь сам."
          icon="pin"
        />
        <RadioRow
          name="filter-place-mode"
          value="city"
          checked={draft.placeMode === "city"}
          onChange={setMode}
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
          {radiusChips}
          <p className="text-[13px] text-ink-soft">
            В результатах останутся идеи с точкой на карте внутри этого радиуса.
          </p>
        </div>
      ) : null}

      {draft.placeMode === "area" ? (
        <div className="space-y-2.5">
          <MapView
            center={draft.point ?? { lat: place.lat, lng: place.lng }}
            radiusM={draft.radius}
            zoom={zoomForRadius(draft.radius)}
            onPick={(point) => patch({ point })}
            label={`Карта: сдвинь её, чтобы круг ${formatRadius(draft.radius)} лёг на нужное место. Стрелки двигают карту.`}
          />
          {radiusChips}
          {error ? (
            <SectionError>{error}</SectionError>
          ) : (
            <p className="text-[13px] text-ink-soft">
              Сдвинь карту — центр круга под булавкой. Останутся идеи с точкой внутри круга.
            </p>
          )}
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
          {error ? (
            <SectionError>{error}</SectionError>
          ) : (
            <p className="text-[13px] text-ink-soft">Города в списке — те, где прямо сейчас есть идеи.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
