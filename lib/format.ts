/**
 * Russian-locale formatting and the shared feed/time rules.
 *
 * Every function that needs the current time takes it as an argument.
 * Server components read the clock once per request and pass it down; client
 * components that tick use <TimeFromNow>. Keeps rendering deterministic and
 * avoids hydration drift.
 */

import type { GeoRadius, Post, Timestamp } from "./types";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** A post leaves the feed one hour after it starts. The chat stays open. */
export const FEED_GRACE_MS = HOUR_MS;

/** Events happen in Germany, so the wall clock stays Berlin. */
const tz = "Europe/Berlin";
const locale = "ru-RU";

const timeFmt = new Intl.DateTimeFormat(locale, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: tz,
});

const dayShortFmt = new Intl.DateTimeFormat(locale, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: tz,
});

const dayLongFmt = new Intl.DateTimeFormat(locale, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: tz,
});

const monthDayFmt = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "long",
  timeZone: tz,
});

/** "день / дня / дней" — Russian needs three forms. */
export function pluralRu(count: number, forms: [string, string, string]): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** Date formatters yield lowercase weekdays in Russian; headers want a cap. */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function toDate(value: Timestamp | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "20:00" */
export function formatTime(value: Timestamp | Date): string {
  return timeFmt.format(toDate(value));
}

/** Midnight in Berlin for the day the given instant falls on. */
export function startOfDay(value: Timestamp | Date): Date {
  const d = toDate(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(d);
  return new Date(`${parts}T00:00:00`);
}

/** Stable key for grouping a feed into day sections: "2026-10-24". */
export function dayKey(value: Timestamp | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(toDate(value));
}

function daysApart(value: Timestamp | Date, now: Date): number {
  return Math.round((startOfDay(value).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** "Сегодня", "Завтра", "Сб, 24 окт." — the sticky header of a day group. */
export function formatDayLabel(value: Timestamp | Date, now: Date): string {
  const diff = daysApart(value, now);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === -1) return "Вчера";
  return capitalize(dayShortFmt.format(toDate(value)));
}

/** "Суббота, 24 октября" — the full line on a post detail page. */
export function formatDayLong(value: Timestamp | Date): string {
  return capitalize(dayLongFmt.format(toDate(value)));
}

/** "24 октября, 20:00" */
export function formatDateTime(value: Timestamp | Date): string {
  return `${monthDayFmt.format(toDate(value))}, ${formatTime(value)}`;
}

/** Value for an <input type="datetime-local">, in Berlin wall-clock time. */
export function toDatetimeLocal(value: Timestamp | Date): string {
  const d = toDate(value);
  const date = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(d);
  return `${date}T${time}`;
}

/**
 * How much time pressure a departure carries. Drives the one hot color in
 * the palette: only `now` and `soon` are allowed to use it.
 */
export type Urgency = "past" | "now" | "soon" | "today" | "later";

export function urgencyOf(value: Timestamp | Date, now: Date): Urgency {
  const delta = toDate(value).getTime() - now.getTime();
  if (delta < 0) return "past";
  if (delta <= 30 * 60 * 1000) return "now";
  if (delta <= 3 * HOUR_MS) return "soon";
  if (daysApart(value, now) === 0) return "today";
  return "later";
}

/** "сейчас", "через 25 мин.", "через 3 ч.", "через 2 дня", "10 мин. назад" */
export function formatRelative(value: Timestamp | Date, now: Date): string {
  const delta = toDate(value).getTime() - now.getTime();
  const abs = Math.abs(delta);
  const minutes = Math.round(abs / 60000);

  if (minutes < 1) return "сейчас";

  let amount: string;
  if (minutes < 60) amount = `${minutes} мин.`;
  else if (abs < DAY_MS) amount = `${Math.round(abs / HOUR_MS)} ч.`;
  else {
    const days = Math.round(abs / DAY_MS);
    amount = `${days} ${pluralRu(days, ["день", "дня", "дней"])}`;
  }

  return delta >= 0 ? `через ${amount}` : `${amount} назад`;
}

/** Short stamp for a chat bubble or a notification row. */
export function formatStamp(value: Timestamp | Date, now: Date): string {
  const diff = daysApart(value, now);
  if (diff === 0) return formatTime(value);
  if (diff === -1) return `Вчера, ${formatTime(value)}`;
  return `${capitalize(dayShortFmt.format(toDate(value)))}, ${formatTime(value)}`;
}

/* ── feed rules ─────────────────────────────────────────────────── */

/**
 * A post is in the feed while sign-up is open and it has not finished.
 * Mirrors the `public.active_posts` view in the database.
 */
export function isInFeed(post: Pick<Post, "is_closed" | "date_start">, now: Date): boolean {
  if (post.is_closed) return false;
  return toDate(post.date_start).getTime() + FEED_GRACE_MS > now.getTime();
}

/** Why a post is no longer listed — shown on the post page itself. */
export function feedExitReason(
  post: Pick<Post, "is_closed" | "date_start">,
  now: Date,
): "closed" | "over" | null {
  if (post.is_closed) return "closed";
  if (toDate(post.date_start).getTime() + FEED_GRACE_MS <= now.getTime()) return "over";
  return null;
}

/** Null when the author set no cap. */
export function seatsLeft(
  post: Pick<Post, "max_participants">,
  participantCount: number,
): number | null {
  if (post.max_participants == null) return null;
  return Math.max(0, post.max_participants - participantCount);
}

export function isFull(
  post: Pick<Post, "max_participants">,
  participantCount: number,
): boolean {
  const left = seatsLeft(post, participantCount);
  return left !== null && left === 0;
}

/* ── places and numbers ─────────────────────────────────────────── */

export function formatRadius(metres: GeoRadius | number): string {
  return metres < 1000 ? `${metres} м` : `${metres / 1000} км`;
}

/** "3 из 5", or "3" when the author set no cap. */
export function formatSeats(participantCount: number, max: number | null): string {
  return max == null ? `${participantCount}` : `${participantCount} из ${max}`;
}

/** "11 участников" — for ideas with no cap. */
export function formatParticipants(count: number): string {
  return `${count} ${pluralRu(count, ["участник", "участника", "участников"])}`;
}

/** "3 места" — for the free-seat counter. */
export function formatPlaces(count: number): string {
  return `${count} ${pluralRu(count, ["место", "места", "мест"])}`;
}

/** 1200 -> "1 200", 14300 -> "14,3 тыс." */
export function formatCount(value: number): string {
  if (value < 10000) return value.toLocaleString(locale);
  return `${(value / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} тыс.`;
}

/**
 * Короткое имя места для строки списка: часть адреса до первой запятой.
 * «Oberbaumbrücke, сторона Фридрихсхайна» -> «Oberbaumbrücke». Полный адрес
 * показывается на странице идеи, а в ленте он всё равно не помещается и
 * обрезается посреди слова.
 */
export function shortPlace(address: string | null, city: string): string {
  const source = address ?? city;
  const head = source.split(",")[0].trim();
  return head.length > 1 ? head : source;
}

export function initialsOf(nickname: string): string {
  const cleaned = nickname.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Metres between two points, for the "radius around me" filter. */
export function distanceMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Minutes from midnight, used by the time-of-day filter. */
export function minutesOfDay(value: Timestamp | Date): number {
  const [h, m] = formatTime(value).split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutesOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
