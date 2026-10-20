import { describe, expect, it } from "vitest";
import { explainDbError, fail } from "./actor";

describe("explainDbError — коды базы словами человека", () => {
  it("каждый известный код — своё объяснение", () => {
    expect(explainDbError({ code: "42501" })).toBe("На это нет прав.");
    expect(explainDbError({ code: "23505" })).toBe("Это уже сделано.");
    expect(explainDbError({ code: "23514" })).toContain("не прошли проверку");
    expect(explainDbError({ code: "23503" })).toContain("уже удалено");
    expect(explainDbError({ code: "PGRST116" })).toContain("Не нашлось");
    expect(explainDbError({ code: "P0429" })).toContain("Слишком часто");
  });

  it("неизвестное и пустое — общий текст, без внутренностей базы", () => {
    const leaked = explainDbError({ code: "XX000", message: 'relation "secret_table" does not exist' });
    expect(leaked).toBe("Не получилось. Попробуй ещё раз.");
    expect(leaked).not.toContain("secret_table");
    expect(explainDbError(null)).toBe("Не получилось. Попробуй ещё раз.");
  });

  it("fail оборачивает в результат действия", () => {
    expect(fail({ code: "42501" })).toEqual({ ok: false, error: "На это нет прав." });
  });
});
