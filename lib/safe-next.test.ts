import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext — путь после входа", () => {
  it.each([
    ["/post/123", "/post/123"],
    ["/messages?tab=direct", "/messages?tab=direct"],
    ["/u/jonas_k#posts", "/u/jonas_k#posts"],
    ["/", "/"],
  ])("пропускает внутренний путь %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  // Каждый из этих путей после нормализации браузером уводит на чужой сайт.
  it.each([
    ["//evil.com", "протокол-относительный адрес"],
    ["/\\evil.com", "обратный слэш"],
    ["/\tevil.com", "табуляция"],
    ["/\n/evil.com", "перевод строки"],
    ["/.//evil.com", "точечный сегмент"],
    ["/a/..//evil.com", "переход на уровень вверх"],
    ["/././/evil.com", "двойной точечный сегмент"],
    ["https://evil.com", "абсолютный адрес"],
    ["evil.com", "путь без слэша"],
    ["javascript:alert(1)", "схема javascript"],
  ])("отклоняет %s (%s)", (input) => {
    expect(safeNext(input)).toBe("/");
  });

  it("не возвращает обратно на экраны входа", () => {
    expect(safeNext("/auth/login")).toBe("/");
    expect(safeNext("/auth/signup?x=1")).toBe("/");
  });

  it("закодированные слэши остаются буквальным путём на нашем сайте", () => {
    expect(safeNext("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
  });

  it("на пустой или нестроковый вход отвечает главной", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
});
