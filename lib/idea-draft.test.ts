import { describe, expect, it } from "vitest";
import { posts } from "@/lib/mock/posts";
import {
  checkIdea,
  DESCRIPTION_MAX,
  GEO_FIELD_IDS,
  geoError,
  geoFocusId,
  geoFromPost,
  geoInputOf,
  initialGeo,
  nextFullHourTomorrow,
  SEATS_MAX,
  TITLE_MAX,
  toChatAccess,
  type IdeaDraft,
} from "./idea-draft";

const now = new Date("2026-10-20T12:30:00Z");
const context = { now, categoryIds: ["sport", "food"] };
const good: IdeaDraft = {
  title: "  Пиво у канала  ",
  description: " Беру ящик. ",
  categoryId: "sport",
  startsAt: "2026-10-21T19:00",
  geo: { ...initialGeo, mode: "city", city: "Берлин" },
  maxParticipants: "",
};

describe("checkIdea", () => {
  it("годная идея: края обрезаны, мест без ограничения", () => {
    const { errors, clean } = checkIdea(good, context);
    expect(errors).toEqual({});
    expect(clean).toEqual({ title: "Пиво у канала", description: "Беру ящик.", seats: null });
  });

  it("пустые название и описание — что написать, а не «ошибка»", () => {
    const { errors } = checkIdea({ ...good, title: " ", description: "" }, context);
    expect(errors.title).toMatch(/Назови идею/);
    expect(errors.description).toMatch(/Опиши/);
  });

  it("длиннее предела — на сколько и до скольки сократить", () => {
    const { errors } = checkIdea(
      { ...good, title: "т".repeat(TITLE_MAX + 2), description: "о".repeat(DESCRIPTION_MAX + 1) },
      context,
    );
    expect(errors.title).toBe(`Название длиннее на 2 символа. Сократи его до ${TITLE_MAX}.`);
    expect(errors.description).toBe(`Описание длиннее на 1 символ. Сократи его до ${DESCRIPTION_MAX}.`);
  });

  it("категория: не выбрана или неизвестна", () => {
    expect(checkIdea({ ...good, categoryId: null }, context).errors.category).toBeDefined();
    expect(checkIdea({ ...good, categoryId: "chess" }, context).errors.category).toBeDefined();
  });

  it("время: пустое, недописанное, прошедшее", () => {
    expect(checkIdea({ ...good, startsAt: "" }, context).errors.startsAt).toMatch(/когда/);
    expect(checkIdea({ ...good, startsAt: "2026-10-21T" }, context).errors.startsAt).toMatch(/не до конца/);
    expect(checkIdea({ ...good, startsAt: "2020-01-01T10:00" }, context).errors.startsAt).toMatch(/прошло/);
  });

  it("места: целое от 2 до 100, иначе — подсказка", () => {
    expect(checkIdea({ ...good, maxParticipants: " 8 " }, context).clean.seats).toBe(8);
    for (const bad of ["1", "2.5", String(SEATS_MAX + 1), "много"]) {
      expect(checkIdea({ ...good, maxParticipants: bad }, context).errors.maxParticipants).toMatch(/целое/);
    }
  });

  it("незаполненное место — ошибка геополя", () => {
    expect(checkIdea({ ...good, geo: { ...initialGeo, mode: "city" } }, context).errors.geo).toMatch(/город/);
  });
});

describe("место", () => {
  it("geoError по режимам", () => {
    expect(geoError(initialGeo)).toBeNull();
    expect(geoError({ ...initialGeo, mode: "area" })).toMatch(/булавка/);
    expect(geoError({ ...initialGeo, mode: "area", point: { lat: 52.5, lng: 13.4 } })).toMatch(/словами/);
    expect(
      geoError({ ...initialGeo, mode: "area", point: { lat: 52.5, lng: 13.4 }, meeting_point: "У моста" }),
    ).toBeNull();
    expect(geoError({ ...initialGeo, mode: "city", city: "  " })).toMatch(/город/);
  });

  it("фокус уходит в поле своего режима", () => {
    expect(geoFocusId(initialGeo)).toBe(GEO_FIELD_IDS.radius);
    expect(geoFocusId({ ...initialGeo, mode: "area" })).toBe(GEO_FIELD_IDS.meetingPoint);
    expect(geoFocusId({ ...initialGeo, mode: "city" })).toBe(GEO_FIELD_IDS.city);
  });

  it("правка начинается с места идеи", () => {
    for (const post of posts) {
      const draft = geoFromPost(post);
      expect(draft.mode).toBe(post.geo_mode);
      if (post.geo_mode === "city") expect(draft.city).toBe(post.geo_city);
      if (post.geo_mode === "area") expect(draft.meeting_point).toBe(post.geo_address ?? "");
      if (post.geo_mode !== "area") expect(draft.point).toBeNull();
    }
  });

  it("geoFromPost: область без координат и радиус без значения", () => {
    const area = posts.find((post) => post.geo_mode === "area") ?? posts[0];
    expect(geoFromPost({ ...area, geo_mode: "area", geo_lat: null, geo_address: null })).toMatchObject({
      point: null,
      meeting_point: "",
    });
    expect(geoFromPost({ ...area, geo_mode: "radius", geo_radius_m: null }).radius_m).toBe(
      initialGeo.radius_m,
    );
  });

  const university = { city: "Берлин", short_name: "TU Berlin" };
  const campus = { lat: 52.51, lng: 13.32, label: "Кампус TU Berlin", source: "campus" as const };

  it("радиус: точка отсчёта и подпись «рядом с кампусом»", () => {
    expect(geoInputOf(initialGeo, campus, university)).toEqual({
      geoMode: "radius",
      geoCity: "Берлин",
      geoAddress: "Рядом с кампусом TU Berlin",
      geoLat: 52.51,
      geoLng: 13.32,
      geoRadiusM: 2000,
    });
    expect(geoInputOf(initialGeo, { ...campus, source: "device" }, university).geoAddress).toBeNull();
  });

  it("без подтверждённого вуза: город по умолчанию и без подписи «у кампуса»", () => {
    const center = { lat: 52.52, lng: 13.405, label: "Центр Берлина", source: "campus" as const };
    expect(geoInputOf(initialGeo, center, null)).toMatchObject({
      geoMode: "radius",
      geoCity: "Берлин",
      geoAddress: null,
    });
    expect(geoInputOf({ ...initialGeo, mode: "area", meeting_point: "У моста" }, center, null).geoCity).toBe(
      "Берлин",
    );
  });

  it("область и город", () => {
    expect(
      geoInputOf(
        { ...initialGeo, mode: "area", point: { lat: 1, lng: 2 }, meeting_point: " У моста " },
        campus,
        university,
      ),
    ).toMatchObject({ geoMode: "area", geoAddress: "У моста", geoLat: 1, geoLng: 2, geoRadiusM: null });
    expect(geoInputOf({ ...initialGeo, mode: "area" }, campus, university)).toMatchObject({ geoLat: null });
    expect(geoInputOf({ ...initialGeo, mode: "city", city: " Потсдам " }, campus, university)).toEqual({
      geoMode: "city",
      geoCity: "Потсдам",
      geoAddress: null,
      geoLat: null,
      geoLng: null,
      geoRadiusM: null,
    });
  });
});

describe("мелочи", () => {
  it("завтра, следующий полный час", () => {
    expect(nextFullHourTomorrow(now).toISOString()).toBe("2026-10-21T13:00:00.000Z");
  });

  it("доступ к чату — только известные значения", () => {
    expect(toChatAccess("followers")).toBe("followers");
    expect(toChatAccess("friends")).toBe("friends");
    expect(toChatAccess("anything")).toBe("everyone");
  });
});
