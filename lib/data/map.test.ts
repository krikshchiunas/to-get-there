import { describe, expect, it } from "vitest";
import {
  noSocialFacts,
  roleIn,
  toCategory,
  toModeratorPermissions,
  toNotificationPayload,
  toNotificationSettings,
  toPollOptions,
  toPrivacySettings,
  toUserView,
} from "./map";

describe("toPrivacySettings — строгая форма из jsonb", () => {
  it("берёт известные значения", () => {
    expect(
      toPrivacySettings({
        who_can_message: "friends",
        who_can_see_profile: "university",
        who_can_see_interests: "friends",
        visible_in_search: false,
        read_receipts: false,
      }),
    ).toEqual({
      who_can_message: "friends",
      who_can_see_profile: "university",
      who_can_see_interests: "friends",
      visible_in_search: false,
      read_receipts: false,
    });
  });

  it("кривое значение роняет одно поле в значение по умолчанию, а не весь экран", () => {
    const settings = toPrivacySettings({ who_can_message: "все", visible_in_search: "да" });
    expect(settings.who_can_message).toBe("everyone");
    expect(settings.visible_in_search).toBe(true);
    expect(settings.read_receipts).toBe(true);
  });

  it("не объект — все значения по умолчанию", () => {
    expect(toPrivacySettings(null).who_can_see_profile).toBe("everyone");
    expect(toPrivacySettings([1, 2]).who_can_see_profile).toBe("everyone");
  });
});

describe("toNotificationSettings / toModeratorPermissions", () => {
  it("недостающее — по умолчанию включено", () => {
    expect(toNotificationSettings({ new_follower: false })).toMatchObject({
      new_follower: false,
      new_participant: true,
    });
  });

  it("права модератора по умолчанию выключены", () => {
    expect(toModeratorPermissions({ can_pin: true })).toEqual({
      can_post_media: false,
      can_pin: true,
      can_poll: false,
      can_kick: false,
    });
  });
});

describe("toPollOptions", () => {
  it("только объекты с label", () => {
    expect(toPollOptions([{ label: "Да" }, { nope: 1 }, "строка", { label: "Нет" }])).toEqual([
      { label: "Да" },
      { label: "Нет" },
    ]);
    expect(toPollOptions({})).toEqual([]);
  });
});

describe("toNotificationPayload", () => {
  it("переносит известные ключи и тип changed", () => {
    expect(
      toNotificationPayload({
        actor_id: "a",
        actor_nickname: "jonas_k",
        actor_avatar_url: null,
        post_id: "p",
        post_title: "Пиво у канала",
        minutes_until: 30,
        changed: "time_place",
      }),
    ).toEqual({
      actor_id: "a",
      actor_nickname: "jonas_k",
      actor_avatar_url: null,
      post_id: "p",
      post_title: "Пиво у канала",
      minutes_until: 30,
      changed: "time_place",
    });
  });

  it("неизвестное и неверного типа отбрасывает", () => {
    expect(toNotificationPayload({ changed: "всё", minutes_until: "30", evil: "<script>" })).toEqual({});
  });
});

describe("toCategory / toUserView / roleIn", () => {
  it("категория — как есть", () => {
    expect(toCategory({ id: "c", name: "Спорт", is_main: true, icon: "ball" })).toEqual({
      id: "c",
      name: "Спорт",
      is_main: true,
      icon: "ball",
    });
  });

  it("без университета профиль не собрать — ошибка, а не пустой вуз", () => {
    const row = {
      id: "u",
      auth_user_id: null,
      nickname: "nick",
      avatar_url: null,
      university_id: "x",
      faculty: null,
      bio: null,
      interests: [],
      goals: [],
      is_verified: false,
      privacy_settings: {},
      notification_settings: {},
      created_at: "2026-01-01T00:00:00Z",
      university: null,
    };
    expect(() => toUserView(row, noSocialFacts)).toThrow(/университет/);
  });

  it("роль считается из множеств", () => {
    const participants = new Set(["p1", "p2"]);
    const moderators = new Set(["p2"]);
    expect(roleIn("p1", "me", "me", participants, moderators)).toBe("author");
    expect(roleIn("p2", "x", "me", participants, moderators)).toBe("moderator");
    expect(roleIn("p1", "x", "me", participants, moderators)).toBe("participant");
    expect(roleIn("p3", "x", "me", participants, moderators)).toBe("guest");
    expect(roleIn("p1", "x", null, participants, moderators)).toBe("guest");
  });
});
