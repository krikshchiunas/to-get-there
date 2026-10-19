import { describe, expect, it } from "vitest";
import { isLocalId, mergeById } from "./use-synced-state";

type Item = { id: string; created_at: string };

const at = (id: string, minute: number): Item => ({
  id,
  created_at: `2026-10-19T15:${String(minute).padStart(2, "0")}:00.000Z`,
});

const byTime = (a: Item, b: Item) => a.created_at.localeCompare(b.created_at);

describe("isLocalId", () => {
  it("узнаёт временные id оптимистичных записей", () => {
    expect(isLocalId("post-1-local-3")).toBe(true);
    expect(isLocalId("poll-post-1-local-1")).toBe(true);
  });

  it("не путает настоящие uuid с временными", () => {
    expect(isLocalId("843f530a-b80f-45a6-97ad-fbab04180b47")).toBe(false);
  });
});

describe("mergeById", () => {
  const none = new Set<string>();

  it("без локальных правок возвращает снимок сервера как есть", () => {
    const server = [at("a", 1), at("b", 2)];
    expect(mergeById(server, server, none, byTime)).toBe(server);
  });

  it("сохраняет сообщение, которое ещё летит на сервер", () => {
    const server = [at("a", 1)];
    const local = [at("a", 1), at("x-local-1", 5)];
    expect(mergeById(server, local, none, byTime).map((i) => i.id)).toEqual(["a", "x-local-1"]);
  });

  it("не задваивает сообщение, которое сервер уже прислал", () => {
    const server = [at("a", 1), at("b", 2)];
    const local = [at("a", 1), at("b", 2)];
    expect(mergeById(server, local, new Set(["b"]), byTime).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("держит подтверждённое, пока снимок его не догнал", () => {
    const server = [at("a", 1)];
    const local = [at("a", 1), at("b", 2)];
    expect(mergeById(server, local, new Set(["b"]), byTime).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("отдаёт удаление серверу: чужое удалённое сообщение исчезает", () => {
    const server = [at("a", 1)];
    const local = [at("a", 1), at("deleted", 2)];
    expect(mergeById(server, local, none, byTime).map((i) => i.id)).toEqual(["a"]);
  });

  it("ставит новое с сервера на своё место по времени", () => {
    const server = [at("a", 1), at("c", 3)];
    const local = [at("a", 1), at("b-local-1", 2)];
    expect(mergeById(server, local, none, byTime).map((i) => i.id)).toEqual(["a", "b-local-1", "c"]);
  });
});
