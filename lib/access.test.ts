import { describe, expect, it } from "vitest";
import { canEnterChat, canMessage, canSeeInterests, canSeeProfile, chatAccessReason } from "./access";
import { currentUser, posts, users } from "./mock";
import type { PostView, PrivacySettings, UserView } from "./types";

/** Человек с нужными настройками и отношением к зрителю. */
function person(over: Partial<UserView> & { privacy?: Partial<PrivacySettings> } = {}): UserView {
  const base = users.find((user) => user.id !== currentUser.id) as UserView;
  const { privacy, ...rest } = over;
  return {
    ...base,
    viewer_follows: false,
    follows_viewer: false,
    viewer_blocked: false,
    ...rest,
    privacy_settings: { ...base.privacy_settings, ...privacy },
  };
}

const viewer = currentUser;

describe("canSeeProfile / canSeeInterests", () => {
  it("себя видно всегда", () => {
    expect(
      canSeeProfile(
        { ...viewer, privacy_settings: { ...viewer.privacy_settings, who_can_see_profile: "friends" } },
        viewer,
      ),
    ).toBe(true);
  });

  it("«все» — видно всем", () => {
    expect(canSeeProfile(person({ privacy: { who_can_see_profile: "everyone" } }), viewer)).toBe(true);
  });

  it("«мой вуз» — только своему вузу", () => {
    const same = person({
      university_id: viewer.university_id,
      privacy: { who_can_see_profile: "university" },
    });
    const other = person({
      university_id: "other-university",
      privacy: { who_can_see_profile: "university" },
    });
    expect(canSeeProfile(same, viewer)).toBe(true);
    expect(canSeeProfile(other, viewer)).toBe(false);
  });

  // Как в базе: NULL = NULL — не «один вуз» (0043). Иначе двое без
  // подтверждённого вуза видели бы профили друг друга «только для своих».
  it("«мой вуз» без подтверждённого вуза — ни своим, ни чужим", () => {
    const nobody = { ...viewer, university_id: null, university: null };
    const hidden = person({
      university_id: null,
      university: null,
      privacy: { who_can_see_profile: "university" },
    });
    expect(canSeeProfile(hidden, nobody)).toBe(false);
    expect(canSeeProfile(hidden, viewer)).toBe(false);
    expect(
      canSeeInterests(
        person({ university_id: viewer.university_id, privacy: { who_can_see_interests: "university" } }),
        nobody,
      ),
    ).toBe(false);
  });

  it("«друзья» — только при взаимной подписке", () => {
    const one = person({ viewer_follows: true, privacy: { who_can_see_interests: "friends" } });
    const both = person({
      viewer_follows: true,
      follows_viewer: true,
      privacy: { who_can_see_interests: "friends" },
    });
    expect(canSeeInterests(one, viewer)).toBe(false);
    expect(canSeeInterests(both, viewer)).toBe(true);
  });
});

describe("canMessage", () => {
  it("себе не написать", () => {
    expect(canMessage(viewer, viewer)).toBe(false);
  });

  it("заблокированному не написать, даже если он принимает всех", () => {
    expect(
      canMessage(person({ viewer_blocked: true, privacy: { who_can_message: "everyone" } }), viewer),
    ).toBe(false);
  });

  it("по настройке получателя", () => {
    expect(canMessage(person({ privacy: { who_can_message: "everyone" } }), viewer)).toBe(true);
    expect(canMessage(person({ privacy: { who_can_message: "nobody" } }), viewer)).toBe(false);
    expect(canMessage(person({ privacy: { who_can_message: "friends" } }), viewer)).toBe(false);
    expect(
      canMessage(
        person({ viewer_follows: true, follows_viewer: true, privacy: { who_can_message: "friends" } }),
        viewer,
      ),
    ).toBe(true);
  });
});

describe("canEnterChat / chatAccessReason", () => {
  const sample = posts[0] as PostView;
  const guestPost = (access: PostView["chat_access"], author: Partial<UserView> = {}): PostView => ({
    ...sample,
    viewer_role: "guest",
    chat_access: access,
    author: { ...sample.author, viewer_follows: false, follows_viewer: false, ...author },
  });

  it("участник входит всегда, какой бы ни был доступ", () => {
    expect(canEnterChat({ ...guestPost("friends"), viewer_role: "participant" })).toBe(true);
  });

  it("«все» — гость входит", () => {
    expect(canEnterChat(guestPost("everyone"))).toBe(true);
    expect(chatAccessReason(guestPost("everyone"))).toBeNull();
  });

  it("«подписчики» — нужна подписка на автора, и причина это называет", () => {
    expect(canEnterChat(guestPost("followers"))).toBe(false);
    expect(chatAccessReason(guestPost("followers"))).toContain("подписчики");
    expect(canEnterChat(guestPost("followers", { viewer_follows: true }))).toBe(true);
  });

  it("«друзья» — только взаимная подписка", () => {
    expect(canEnterChat(guestPost("friends", { viewer_follows: true }))).toBe(false);
    expect(chatAccessReason(guestPost("friends"))).toContain("друзья");
    expect(canEnterChat(guestPost("friends", { viewer_follows: true, follows_viewer: true }))).toBe(true);
  });
});
