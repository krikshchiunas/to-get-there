import { afterEach, describe, expect, it, vi } from "vitest";
import { getOperator } from "./legal";

describe("getOperator — данные Impressum из окружения", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("без обязательных полей — null: страница скажет, что Impressum не заполнен", () => {
    vi.stubEnv("LEGAL_OPERATOR_NAME", "Max Muster");
    vi.stubEnv("LEGAL_OPERATOR_ADDRESS", "");
    vi.stubEnv("LEGAL_OPERATOR_EMAIL", "max@example.org");
    expect(getOperator()).toBeNull();
  });

  it("адрес — строки через «|», ответственный по умолчанию — оператор", () => {
    vi.stubEnv("LEGAL_OPERATOR_NAME", "Max Muster");
    vi.stubEnv("LEGAL_OPERATOR_ADDRESS", "Musterstraße 1 | 10115 Berlin");
    vi.stubEnv("LEGAL_OPERATOR_EMAIL", "max@example.org");
    vi.stubEnv("LEGAL_OPERATOR_PHONE", "");
    expect(getOperator()).toEqual({
      name: "Max Muster",
      address: ["Musterstraße 1", "10115 Berlin"],
      email: "max@example.org",
      phone: null,
      contentResponsible: "Max Muster",
      vatId: null,
    });
  });
});
