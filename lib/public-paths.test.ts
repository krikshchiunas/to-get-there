import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("открывает вход, юридические страницы и проверку живости", () => {
    for (const path of [
      "/auth/login",
      "/auth/signup",
      "/legal",
      "/legal/impressum",
      "/legal/privacy",
      "/api/health",
    ]) {
      expect(isPublicPath(path)).toBe(true);
    }
  });

  it("всё остальное — только после входа", () => {
    for (const path of [
      "/",
      "/post/1",
      "/settings",
      "/api/account/export",
      "/legalese",
      "/authx",
      "/api/healthz",
    ]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });
});
