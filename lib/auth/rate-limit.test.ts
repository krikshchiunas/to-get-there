import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

const { checkAuthRateLimit, limiterKey } = await import("./rate-limit");

describe("limiterKey", () => {
  it("HMAC: в базу уходит не почта и не адрес", () => {
    const key = limiterKey("secret", "email", "max@gmail.com");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain("max");
  });

  it("стабилен для одного значения и разный для разных ключей и видов", () => {
    expect(limiterKey("s", "email", "a@b.de")).toBe(limiterKey("s", "email", "a@b.de"));
    expect(limiterKey("s", "email", "a@b.de")).not.toBe(limiterKey("s", "ip", "a@b.de"));
    expect(limiterKey("s", "email", "a@b.de")).not.toBe(limiterKey("t", "email", "a@b.de"));
  });
});

describe("checkAuthRateLimit", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "false");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    rpc.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("база ответила 0 — можно; ключи хешированы", async () => {
    rpc.mockResolvedValue({ data: 0, error: null });
    await expect(
      checkAuthRateLimit("sign_in", { address: "203.0.113.7", email: "max@gmail.com" }),
    ).resolves.toEqual({
      allowed: true,
    });
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("auth_attempt");
    expect(args.operation).toBe("sign_in");
    expect(args.ip_key).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(args)).not.toMatch(/203\.0\.113|max@gmail/);
  });

  it("база ответила «через N секунд» — нельзя", async () => {
    rpc.mockResolvedValue({ data: 120, error: null });
    await expect(
      checkAuthRateLimit("password_reset", { address: null, email: "max@gmail.com" }),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 120,
    });
    expect(rpc.mock.calls[0][1].ip_key).toBeNull();
  });

  it("сбой базы или нет ключа — пропускаем (лимиты GoTrue остаются), с предупреждением", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(checkAuthRateLimit("sign_up", { address: "1.2.3.4", email: null })).resolves.toEqual({
      allowed: true,
    });

    rpc.mockRejectedValue(new Error("network"));
    await expect(checkAuthRateLimit("sign_up", { address: "1.2.3.4", email: null })).resolves.toEqual({
      allowed: true,
    });

    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    rpc.mockReset();
    await expect(checkAuthRateLimit("sign_in", { address: "1.2.3.4", email: "a@b.de" })).resolves.toEqual({
      allowed: true,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("демо без базы — лимитов нет", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "true");
    await expect(checkAuthRateLimit("sign_in", { address: "1.2.3.4", email: "a@b.de" })).resolves.toEqual({
      allowed: true,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
