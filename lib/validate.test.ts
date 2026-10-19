import { describe, expect, it } from "vitest";
import { areUuids, isUuid, oneOf, optionalUuid, text } from "./validate";

const id = "33333333-3333-3333-3333-000000000001";

describe("isUuid", () => {
  it("принимает uuid в нижнем регистре", () => {
    expect(isUuid(id)).toBe(true);
  });

  it("отклоняет всё остальное", () => {
    for (const value of ["", "abc", "AAAAAAAA-0000-0000-0000-00000000000A", `${id} `, `${id}x`, 42, null, undefined, {}, [id]]) {
      expect(isUuid(value)).toBe(false);
    }
  });

  it("areUuids — все сразу", () => {
    expect(areUuids(id, id)).toBe(true);
    expect(areUuids(id, "nope")).toBe(false);
  });
});

describe("text", () => {
  it("обрезает края и не падает на не-строках", () => {
    expect(text("  привет  ")).toBe("привет");
    expect(text(5)).toBe("");
    expect(text(null)).toBe("");
    expect(text({ toString: () => "x" })).toBe("");
  });
});

describe("optionalUuid", () => {
  it("null и undefined — это «нет»", () => {
    expect(optionalUuid(null)).toEqual({ ok: true, value: null });
    expect(optionalUuid(undefined)).toEqual({ ok: true, value: null });
  });

  it("uuid проходит, мусор — нет", () => {
    expect(optionalUuid(id)).toEqual({ ok: true, value: id });
    expect(optionalUuid("1")).toEqual({ ok: false });
  });
});

describe("oneOf", () => {
  it("значение из списка или null", () => {
    expect(oneOf("spam", ["spam", "other"] as const)).toBe("spam");
    expect(oneOf("SPAM", ["spam"] as const)).toBeNull();
    expect(oneOf(1, ["spam"] as const)).toBeNull();
  });
});
