import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-vercel-id": "fra1::req-1" }),
}));

const { reportAuthEvent, reportAuthFailure } = await import("./report");

describe("reportAuthFailure", () => {
  let error: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let info: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    error = vi.spyOn(console, "error").mockImplementation(() => {});
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    info = vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("неверный пароль — категория есть, строки в журнале нет", async () => {
    expect(
      await reportAuthFailure("sign_in", "/auth/login", { code: "invalid_credentials", status: 400 }),
    ).toBe("invalid_credentials");
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("лимит — предупреждение с id запроса и кодом, без сообщения сервера", async () => {
    await reportAuthFailure("sign_in", "/auth/login", {
      code: "over_request_rate_limit",
      status: 429,
      message: "Request rate limit reached for user@example.com",
    });
    expect(warn).toHaveBeenCalledOnce();
    const line = String(warn.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      op: "sign_in",
      outcome: "rate_limited",
      request_id: "fra1::req-1",
    });
    expect(line).not.toContain("user@example.com");
  });

  it("сбой по категории — ошибка в журнале", async () => {
    expect(await reportAuthFailure("sign_up", "/auth/signup", "server")).toBe("server");
    expect(error).toHaveBeenCalledOnce();
  });

  it("событие успеха — info", async () => {
    await reportAuthEvent("profile_repair", "session");
    expect(JSON.parse(String(info.mock.calls[0][0]))).toMatchObject({ outcome: "ok", op: "profile_repair" });
  });
});
