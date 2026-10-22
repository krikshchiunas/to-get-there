import { describe, expect, it } from "vitest";
import { emailLinkType, plausibleTokenHash } from "./email-link";

describe("emailLinkType", () => {
  it("известные виды — как есть, остальное — подтверждение почты", () => {
    expect(emailLinkType("recovery")).toBe("recovery");
    expect(emailLinkType("signup")).toBe("signup");
    expect(emailLinkType("email")).toBe("email");
    expect(emailLinkType("magiclink")).toBe("email");
    expect(emailLinkType(null)).toBe("email");
  });
});

describe("plausibleTokenHash", () => {
  it("токен GoTrue и PKCE-токен — да", () => {
    expect(plausibleTokenHash("a3f9c0de9b1e4f7a8c2d")).toBe(true);
    expect(plausibleTokenHash("pkce_0123456789abcdef0123456789abcdef")).toBe(true);
  });

  it("пусто, коротко, длинно или с мусором — нет", () => {
    expect(plausibleTokenHash("")).toBe(false);
    expect(plausibleTokenHash("short")).toBe(false);
    expect(plausibleTokenHash("x".repeat(200))).toBe(false);
    expect(plausibleTokenHash("<script>alert(1)</script>")).toBe(false);
    expect(plausibleTokenHash(undefined)).toBe(false);
  });
});
