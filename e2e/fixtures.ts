import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

/**
 * Общее для всех E2E: каждый тест следит за ошибками в консоли страницы, а
 * проверка доступности одна на весь набор — WCAG 2.2 A и AA через axe.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await provide(errors);
  },
});

export { expect };

/** Нарушения WCAG 2.2 A/AA на текущей странице — список для понятного отчёта. */
export async function accessibilityViolations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // Карта Leaflet — сторонняя разметка тайлов; её подпись даём сами (aria-label).
    .exclude(".leaflet-container")
    .analyze();
  return result.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(", ")}`,
  );
}
