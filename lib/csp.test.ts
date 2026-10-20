import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce, tileSource } from "./csp";

const base = {
  nonce: "abc123",
  dev: false,
  supabaseUrl: "https://xyz.supabase.co",
  tileUrl: undefined,
  mocks: false,
};

function directive(csp: string, name: string): string {
  return csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("contentSecurityPolicy", () => {
  it("пускает скрипты только с nonce, без unsafe-inline и unsafe-eval", () => {
    const script = directive(contentSecurityPolicy(base), "script-src");
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
  });

  it("в разработке разрешает eval и ws для Fast Refresh, на проде — нет", () => {
    const dev = contentSecurityPolicy({ ...base, dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy(base)).toContain("upgrade-insecure-requests");
  });

  it("открывает Supabase для API, realtime и картинок", () => {
    const csp = contentSecurityPolicy(base);
    expect(directive(csp, "connect-src")).toContain("https://xyz.supabase.co");
    expect(directive(csp, "connect-src")).toContain("wss://xyz.supabase.co");
    expect(directive(csp, "img-src")).toContain("https://xyz.supabase.co");
  });

  it("пускает тайлы OSM по умолчанию и свой провайдер, если задан", () => {
    expect(directive(contentSecurityPolicy(base), "img-src")).toContain("https://tile.openstreetmap.org");
    const custom = contentSecurityPolicy({
      ...base,
      tileUrl: "https://{s}.tiles.example.com/{z}/{x}/{y}.png",
    });
    expect(directive(custom, "img-src")).toContain("https://*.tiles.example.com");
  });

  it("запрещает фреймы, плагины и чужие формы", () => {
    const csp = contentSecurityPolicy(base);
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
  });

  it("моковые хосты картинок — только в режиме моков", () => {
    expect(contentSecurityPolicy(base)).not.toContain("unsplash");
    expect(contentSecurityPolicy({ ...base, mocks: true })).toContain("https://images.unsplash.com");
  });

  it("без адреса Supabase не вставляет null", () => {
    expect(contentSecurityPolicy({ ...base, supabaseUrl: undefined })).not.toContain("null");
  });
});

describe("tileSource", () => {
  it("не принимает http и мусор", () => {
    expect(tileSource("http://tiles.example.com/{z}/{x}/{y}.png")).toBeNull();
    expect(tileSource("not a url")).toBeNull();
  });
});

describe("createNonce", () => {
  it("каждый раз новый и достаточно длинный", () => {
    const a = createNonce();
    expect(a).not.toBe(createNonce());
    expect(atob(a)).toHaveLength(16);
  });
});
