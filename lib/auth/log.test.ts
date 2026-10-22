import { describe, expect, it } from "vitest";
import { authLogLine, requestIdFrom } from "./log";

const at = new Date("2026-10-22T12:00:00Z");

describe("authLogLine", () => {
  it("одна строка JSON: операция, итог, код Auth, маршрут, id запроса", () => {
    const line = authLogLine(
      { op: "sign_in", kind: "rate_limited", status: 429, code: "over_request_rate_limit" },
      { route: "/auth/login", requestId: "fra1::abc-123", at },
    );
    expect(JSON.parse(line)).toEqual({
      level: "warn",
      event: "auth",
      op: "sign_in",
      outcome: "rate_limited",
      status: 429,
      code: "over_request_rate_limit",
      route: "/auth/login",
      request_id: "fra1::abc-123",
      at: "2026-10-22T12:00:00.000Z",
    });
  });

  it("сбой — error, успех — info", () => {
    const context = { route: "/x", requestId: null, at };
    expect(JSON.parse(authLogLine({ op: "sign_up", kind: "server" }, context)).level).toBe("error");
    expect(JSON.parse(authLogLine({ op: "profile_repair", kind: "ok" }, context)).level).toBe("info");
  });

  it("в строке нет полей для почты, пароля, токена или IP", () => {
    const line = authLogLine(
      { op: "sign_in", kind: "server" },
      { route: "/auth/login", requestId: null, at },
    );
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(
      ["at", "code", "event", "level", "op", "outcome", "request_id", "route", "status"].sort(),
    );
  });
});

describe("requestIdFrom", () => {
  const headers = (entries: Record<string, string>) => new Headers(entries);

  it("x-vercel-id, иначе x-request-id", () => {
    expect(requestIdFrom(headers({ "x-vercel-id": "fra1::iad1::xyz" }))).toBe("fra1::iad1::xyz");
    expect(requestIdFrom(headers({ "x-request-id": "req-42" }))).toBe("req-42");
    expect(requestIdFrom(headers({}))).toBeNull();
  });

  it("произвольный текст от клиента в журнал не попадает", () => {
    expect(requestIdFrom(headers({ "x-request-id": '"}, {"level":"info' }))).toBeNull();
    expect(requestIdFrom(headers({ "x-request-id": "a b" }))).toBeNull();
  });
});
