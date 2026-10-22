"use client";

import { useCallback, useEffect, useState } from "react";
import { campusPlace, roundCoord, type Place } from "./place";
import type { University } from "./types";

const STORAGE_KEY = "tgt-place";

/**
 * Где человек сейчас — для поиска рядом и для формы идеи.
 *
 * Без спроса браузерную геолокацию не трогаем: по умолчанию — кампус.
 * Если человек нажал «Определить точнее» и разрешил, точка (огрублённая
 * до ~100 м) запоминается на время вкладки — чтобы поиск и форма идеи не
 * спрашивали снова. В localStorage её нет: на чужом компьютере она не
 * переживёт закрытие вкладки.
 */
export function usePlace(university: Pick<University, "short_name" | "campus_lat" | "campus_lng"> | null) {
  const campus = campusPlace(university);
  const [device, setDevice] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
      if (typeof saved.lat === "number" && typeof saved.lng === "number") {
        setDevice({ lat: saved.lat, lng: saved.lng, label: "Твоё местоположение", source: "device" });
      }
    } catch {
      // Хранилище закрыто (приватный режим) — останемся на кампусе.
    }
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Браузер не умеет определять местоположение. Считаем от кампуса.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place: Place = {
          lat: roundCoord(position.coords.latitude, 3),
          lng: roundCoord(position.coords.longitude, 3),
          label: "Твоё местоположение",
          source: "device",
        };
        setDevice(place);
        setLocating(false);
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: place.lat, lng: place.lng }));
        } catch {
          // Не запомнили — спросим в следующий раз.
        }
      },
      (failure) => {
        setLocating(false);
        setError(
          failure.code === failure.PERMISSION_DENIED
            ? "Доступ к местоположению закрыт. Считаем от кампуса — разрешить можно в настройках браузера."
            : "Не получилось определить местоположение. Считаем от кампуса.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const resetToCampus = useCallback(() => {
    setDevice(null);
    setError(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Нечего удалять.
    }
  }, []);

  return { place: device ?? campus, locate, resetToCampus, locating, error };
}
