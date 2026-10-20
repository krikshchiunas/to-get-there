import { describe, expect, it } from "vitest";
import { messageActions, rightsOf } from "./rights";

describe("rightsOf", () => {
  it("автор может всё", () => {
    expect(rightsOf("author", null)).toMatchObject({
      isAuthor: true,
      canSend: true,
      canPostMedia: true,
      canPin: true,
      canPoll: true,
      canKick: true,
    });
  });

  it("модератор — ровно то, что выдал автор", () => {
    const rights = rightsOf("moderator", { can_pin: true, can_poll: false, can_post_media: true, can_kick: false });
    expect(rights).toMatchObject({ isAuthor: false, canSend: true, canPin: true, canPoll: false, canPostMedia: true, canKick: false });
  });

  it("модератор без прав в базе — только писать", () => {
    expect(rightsOf("moderator", null)).toMatchObject({ canSend: true, canPin: false, canKick: false });
  });

  it("участник пишет, гость — нет", () => {
    expect(rightsOf("participant", null).canSend).toBe(true);
    expect(rightsOf("guest", null).canSend).toBe(false);
    expect(rightsOf("guest", null).canPin).toBe(false);
  });
});

describe("messageActions — только то, что разрешит база", () => {
  const theirs = { author_id: "them", content: "Привет", is_pinned: false };
  const mine = { author_id: "me", content: "Буду к семи", is_pinned: true };
  const participant = rightsOf("participant", null);
  const author = rightsOf("author", null);

  it("участник: ответить, скопировать, пожаловаться — но не удалить чужое", () => {
    expect(messageActions(theirs, "me", participant, true)).toEqual(["reply", "copy", "report"]);
  });

  it("своё сообщение: удалить можно, пожаловаться на себя — нет", () => {
    expect(messageActions(mine, "me", participant, true)).toEqual(["reply", "copy", "delete"]);
  });

  it("автор идеи: закрепить и удалить любое", () => {
    expect(messageActions(theirs, "me", author, true)).toEqual(["reply", "copy", "pin", "delete", "report"]);
    expect(messageActions(mine, "me", author, true)).toContain("unpin");
  });

  it("гость не отвечает; у фото без подписи нечего копировать", () => {
    expect(messageActions({ ...theirs, content: "  " }, "me", rightsOf("guest", null), false)).toEqual(["report"]);
  });
});
