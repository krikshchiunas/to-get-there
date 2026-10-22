import { describe, expect, it } from "vitest";
import { clientAddress, requestIdOf } from "./request";

const headers = (values: Record<string, string>) => new Headers(values);

describe("clientAddress", () => {
  it("на Vercel — заголовок платформы, а не то, что прислал клиент", () => {
    expect(
      clientAddress(headers({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "198.51.100.1" })),
    ).toBe("203.0.113.7");
  });

  it("иначе x-real-ip, потом первый адрес x-forwarded-for", () => {
    expect(clientAddress(headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientAddress(headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("ничего нет — null, лимит по адресу просто не считается", () => {
    expect(clientAddress(headers({}))).toBeNull();
    expect(clientAddress(headers({ "x-forwarded-for": " , " }))).toBeNull();
  });

  it("длинный мусор обрезается", () => {
    expect(clientAddress(headers({ "x-real-ip": "x".repeat(500) }))?.length).toBe(64);
  });
});

describe("requestIdOf", () => {
  it("id Vercel, если он есть и похож на id", () => {
    expect(requestIdOf(headers({ "x-vercel-id": "fra1::iad1::abc-123" }))).toBe("fra1::iad1::abc-123");
  });

  it("иначе — свежий случайный, а не то, что прислал клиент с мусором", () => {
    const made = requestIdOf(headers({ "x-request-id": "<script>" }));
    expect(made).toMatch(/^[0-9a-f-]{36}$/);
  });
});
