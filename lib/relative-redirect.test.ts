import { describe, expect, it } from "vitest";
import { relativeRedirect } from "./relative-redirect";

describe("relativeRedirect", () => {
  it("303 с относительным Location — браузер останется на своём хосте", () => {
    const response = relativeRedirect("/auth/reset");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/auth/reset");
  });

  it("чужой хост или протокол-относительный адрес — ошибка, а не открытый редирект", () => {
    expect(() => relativeRedirect("https://evil.example")).toThrow();
    expect(() => relativeRedirect("//evil.example")).toThrow();
  });
});
