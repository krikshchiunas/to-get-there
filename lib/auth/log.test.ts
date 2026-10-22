import { afterEach, describe, expect, it, vi } from "vitest";
import { authLogRecord, logAuthEvent, type AuthEvent } from "./log";

const now = new Date("2026-10-22T12:00:00Z");

describe("authLogRecord — только разрешённые поля", () => {
  it("операция, итог, категория, маршрут, id запроса, время", () => {
    expect(
      authLogRecord(
        {
          op: "sign_in",
          outcome: "failure",
          category: "invalid_credentials",
          route: "/auth/login",
          requestId: "r1",
        },
        now,
      ),
    ).toEqual({
      evt: "auth",
      ts: "2026-10-22T12:00:00.000Z",
      op: "sign_in",
      outcome: "failure",
      category: "invalid_credentials",
      route: "/auth/login",
      requestId: "r1",
    });
  });

  it("лишнее, переданное по ошибке (почта, пароль, токен), в запись не попадает", () => {
    const leaky = {
      op: "sign_in",
      outcome: "ok",
      route: "/auth/login",
      requestId: "r2",
      email: "max@gmail.com",
      password: "hunter2-hunter2",
      access_token: "eyJhbGciOi",
    } as unknown as AuthEvent;
    const line = JSON.stringify(authLogRecord(leaky, now));
    expect(line).not.toMatch(/max@gmail|hunter2|eyJhbGciOi/);
  });

  it("маршрут — без строки запроса: в ней бывают токены", () => {
    expect(
      authLogRecord(
        { op: "email_link", outcome: "failure", route: "/auth/confirm?token_hash=secret", requestId: "r3" },
        now,
      ).route,
    ).toBe("/auth/confirm");
  });
});

describe("logAuthEvent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("успех — info, отказ и лимит — warn; одна строка JSON", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logAuthEvent({ op: "sign_out", outcome: "ok", route: "/settings", requestId: "a" });
    logAuthEvent({
      op: "sign_in",
      outcome: "rate_limited",
      category: "rate_limited",
      route: "/auth/login",
      requestId: "b",
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({
      op: "sign_in",
      outcome: "rate_limited",
    });
  });
});
