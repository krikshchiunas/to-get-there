/**
 * Черновик идеи на экране «Новая идея» и в правке: поля, их проверка и то,
 * что уходит в createPost / updatePost. Без React — правила покрываются
 * тестами (lib/idea-draft.test.ts), форма только показывает результат.
 *
 * Те же пределы, что CHECK-ограничения в 0004 и validate() в
 * app/actions/posts.ts: ошибка видна до похода на сервер.
 */

import { DAY_MS, HOUR_MS, pluralRu } from "@/lib/format";
import type { Place } from "@/lib/place";
import type { ChatAccess, GeoMode, GeoRadius, PostView, University } from "@/lib/types";

export const TITLE_MAX = 70;
export const DESCRIPTION_MAX = 600;
export const SEATS_MIN = 2;
export const SEATS_MAX = 100;

/* ── место ─────────────────────────────────────────────────────────── */

/**
 * Как автор указывает место. Три взаимоисключающих режима пишут в один
 * черновик, поэтому форма отдаёт одно значение и получает одно обратно.
 */
export interface GeoDraft {
  mode: GeoMode;
  radius_m: GeoRadius;
  /** Область: центр, выбранный на карте. */
  point: { lat: number; lng: number } | null;
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

/** Куда перевести фокус, если место заполнено не до конца. */
export const GEO_FIELD_IDS = {
  radius: "create-geo-radius",
  meetingPoint: "create-geo-meeting-point",
  city: "create-geo-city",
} as const;

export function geoFocusId(geo: GeoDraft): string {
  if (geo.mode === "area") return GEO_FIELD_IDS.meetingPoint;
  if (geo.mode === "city") return GEO_FIELD_IDS.city;
  return GEO_FIELD_IDS.radius;
}

/** Null, когда место заполнено. Говорит, что сделать, а не что сломалось. */
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

/** Место идеи — в черновик формы, чтобы правка начиналась с того, что есть. */
export function geoFromPost(post: PostView): GeoDraft {
  return {
    mode: post.geo_mode,
    radius_m: post.geo_radius_m ?? initialGeo.radius_m,
    point:
      post.geo_mode === "area" && post.geo_lat != null && post.geo_lng != null
        ? { lat: post.geo_lat, lng: post.geo_lng }
        : null,
    meeting_point: post.geo_mode === "area" ? (post.geo_address ?? "") : "",
    city: post.geo_mode === "city" ? post.geo_city : "",
  };
}

/**
 * Место для сервера. Радиус — точка отсчёта (кампус или геолокация); сервер
 * огрубит её до километра. Область — точка, выбранная на карте, и подсказка
 * словами. Город — только город. Город обязателен в любом режиме.
 */
export function geoInputOf(geo: GeoDraft, place: Place, university: Pick<University, "city" | "short_name">) {
  if (geo.mode === "radius") {
    return {
      geoMode: "radius" as const,
      geoCity: university.city,
      geoAddress: place.source === "campus" ? `Рядом с кампусом ${university.short_name}` : null,
      geoLat: place.lat,
      geoLng: place.lng,
      geoRadiusM: geo.radius_m,
    };
  }
  if (geo.mode === "area") {
    return {
      geoMode: "area" as const,
      geoCity: university.city,
      geoAddress: geo.meeting_point.trim(),
      geoLat: geo.point?.lat ?? null,
      geoLng: geo.point?.lng ?? null,
      geoRadiusM: null,
    };
  }
  return {
    geoMode: "city" as const,
    geoCity: geo.city.trim(),
    geoAddress: null,
    geoLat: null,
    geoLng: null,
    geoRadiusM: null,
  };
}

/* ── поля ──────────────────────────────────────────────────────────── */

export const IDEA_FIELD_IDS = {
  title: "create-title",
  description: "create-description",
  startsAt: "create-starts-at",
  maxParticipants: "create-max-participants",
} as const;

export type IdeaField = keyof typeof IDEA_FIELD_IDS | "category" | "geo";
export type IdeaErrors = Partial<Record<IdeaField, string>>;

/** Порядок проверки — он же порядок, в котором прыгает фокус. */
export const IDEA_FIELD_ORDER: readonly IdeaField[] = [
  "title",
  "description",
  "category",
  "startsAt",
  "geo",
  "maxParticipants",
];

export interface IdeaDraft {
  title: string;
  description: string;
  categoryId: string | null;
  /** Значение datetime-local: «2026-10-21T19:00». */
  startsAt: string;
  geo: GeoDraft;
  maxParticipants: string;
}

const charForms: [string, string, string] = ["символ", "символа", "символов"];

/** Завтра, округлённое вверх до часа. По эпохе, поэтому сервер и браузер совпадают в любом поясе. */
export function nextFullHourTomorrow(now: Date): Date {
  const tomorrow = now.getTime() + DAY_MS;
  return new Date(Math.floor(tomorrow / HOUR_MS) * HOUR_MS + HOUR_MS);
}

export function toChatAccess(raw: string): ChatAccess {
  if (raw === "followers") return "followers";
  if (raw === "friends") return "friends";
  return "everyone";
}

/**
 * Проверка перед отправкой. `clean` — обрезанные строки и число мест; оно
 * имеет смысл, только когда `errors` пуст.
 */
export function checkIdea(
  draft: IdeaDraft,
  context: { now: Date; categoryIds: readonly string[] },
): { errors: IdeaErrors; clean: { title: string; description: string; seats: number | null } } {
  const errors: IdeaErrors = {};

  const title = draft.title.trim();
  if (!title) {
    errors.title = "Назови идею — например, «Пиво у канала после занятий».";
  } else if (title.length > TITLE_MAX) {
    const over = title.length - TITLE_MAX;
    errors.title = `Название длиннее на ${over} ${pluralRu(over, charForms)}. Сократи его до ${TITLE_MAX}.`;
  }

  const description = draft.description.trim();
  if (!description) {
    errors.description = "Опиши, что будет, чтобы было понятно, на что человек идёт.";
  } else if (description.length > DESCRIPTION_MAX) {
    const over = description.length - DESCRIPTION_MAX;
    errors.description = `Описание длиннее на ${over} ${pluralRu(over, charForms)}. Сократи его до ${DESCRIPTION_MAX}.`;
  }

  if (draft.categoryId === null || !context.categoryIds.includes(draft.categoryId)) {
    errors.category = "Выбери категорию, иначе идею не найдут.";
  }

  const start = new Date(draft.startsAt);
  if (!draft.startsAt) {
    errors.startsAt = "Укажи, когда начинаете.";
  } else if (Number.isNaN(start.getTime())) {
    errors.startsAt = "Дата или время заполнены не до конца. Укажи и то и другое.";
  } else if (start.getTime() <= context.now.getTime()) {
    errors.startsAt = "Это время уже прошло. Выбери время в будущем.";
  }

  const placeProblem = geoError(draft.geo);
  if (placeProblem) errors.geo = placeProblem;

  const cap = draft.maxParticipants.trim();
  let seats: number | null = null;
  if (cap) {
    const parsed = Number(cap);
    if (!Number.isInteger(parsed) || parsed < SEATS_MIN || parsed > SEATS_MAX) {
      errors.maxParticipants = `Введи целое число от ${SEATS_MIN} до ${SEATS_MAX} или оставь поле пустым — тогда без ограничений.`;
    } else {
      seats = parsed;
    }
  }

  return { errors, clean: { title, description, seats } };
}
