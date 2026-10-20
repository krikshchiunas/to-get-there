"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Circle, CircleMarker, Map as LeafletMap } from "leaflet";

/**
 * Карта на Leaflet и тайлах OpenStreetMap — без ключа и без трекинга.
 *
 * Тайлы можно сменить переменной NEXT_PUBLIC_MAP_TILE_URL: у OSM есть
 * правила использования, и при большом трафике нужен свой провайдер.
 *
 * Два режима:
 *   - просмотр: точка и, если задано, круг вокруг неё;
 *   - выбор (`onPick`): точка — это центр карты. Карту двигают под
 *     неподвижной булавкой пальцем, мышью или стрелками с клавиатуры, и
 *     после каждой остановки форма получает новый центр. Так выбор
 *     доступен без точного попадания пальцем и без мыши.
 *
 * Колесо мыши карту не масштабирует: иначе страница «застревала» бы на ней
 * при прокрутке. Масштаб — кнопками +/− или жестом.
 */

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

export interface LatLng {
  lat: number;
  lng: number;
}

export function MapView({
  center,
  radiusM,
  zoom = 14,
  label,
  onPick,
  className = "h-56",
}: {
  center: LatLng;
  /** Круг вокруг точки, в метрах. */
  radiusM?: number | null;
  zoom?: number;
  /** Что изображено — для скринридера. */
  label: string;
  /** Режим выбора: центр карты после каждой остановки. */
  onPick?: (next: LatLng) => void;
  className?: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const circle = useRef<Circle | null>(null);
  const dot = useRef<CircleMarker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const picking = Boolean(onPick);

  // Карта создаётся один раз; Leaflet трогает window, поэтому импорт — тут.
  useEffect(() => {
    let cancelled = false;
    let instance: LeafletMap | null = null;

    void import("leaflet").then((L) => {
      if (cancelled || !node.current) return;
      instance = L.map(node.current, {
        center: [center.lat, center.lng],
        zoom,
        scrollWheelZoom: false,
        keyboard: true,
        attributionControl: true,
      });
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(instance);

      const accent =
        getComputedStyle(document.documentElement).getPropertyValue("--c-signal").trim() || "#2f3bee";
      circle.current = L.circle([center.lat, center.lng], {
        radius: radiusM ?? 0,
        color: accent,
        weight: 1.5,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(instance);
      if (!picking) {
        dot.current = L.circleMarker([center.lat, center.lng], {
          radius: 6,
          color: "#ffffff",
          weight: 2,
          fillColor: accent,
          fillOpacity: 1,
          interactive: false,
        }).addTo(instance);
      }

      instance.on("move", () => {
        if (!pickRef.current || !instance) return;
        circle.current?.setLatLng(instance.getCenter());
      });
      instance.on("moveend", () => {
        if (!pickRef.current || !instance) return;
        const { lat, lng } = instance.getCenter();
        pickRef.current({ lat, lng });
      });

      map.current = instance;
    });

    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
      circle.current = null;
      dot.current = null;
    };
    // Только при монтировании: дальше центр и круг двигают эффекты ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Снаружи сменили точку (например, «Определить точнее») — переехать.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const current = instance.getCenter();
    if (Math.abs(current.lat - center.lat) < 1e-6 && Math.abs(current.lng - center.lng) < 1e-6) return;
    instance.setView([center.lat, center.lng], instance.getZoom(), { animate: false });
    circle.current?.setLatLng([center.lat, center.lng]);
    dot.current?.setLatLng([center.lat, center.lng]);
  }, [center.lat, center.lng]);

  useEffect(() => {
    circle.current?.setRadius(radiusM ?? 0);
  }, [radiusM]);

  return (
    <figure className={`tgt-map relative overflow-hidden rounded-field bg-sunken ${className}`}>
      <div ref={node} className="absolute inset-0" aria-label={label} role="region" />
      {picking ? (
        // Булавка — центр карты, а не маркер: её не надо ловить пальцем.
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-[500] -translate-x-1/2 -translate-y-full"
        >
          <svg width="28" height="36" viewBox="0 0 28 36">
            <path
              d="M14 35s11-11.6 11-20.5A11 11 0 0 0 3 14.5C3 23.4 14 35 14 35z"
              fill="var(--c-signal)"
              stroke="var(--c-surface)"
              strokeWidth="2"
            />
            <circle cx="14" cy="14.5" r="4" fill="var(--c-surface)" />
          </svg>
        </span>
      ) : null}
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
