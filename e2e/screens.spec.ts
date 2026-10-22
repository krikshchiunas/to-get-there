import { accessibilityViolations, expect, test } from "./fixtures";

/**
 * Каждый экран: открывается без ошибок, называет себя в заголовке вкладки,
 * проходит axe (WCAG 2.2 AA) и не даёт горизонтальной прокрутки на телефоне.
 */
const screens: { path: string; title: RegExp }[] = [
  { path: "/", title: /Идеи/ },
  { path: "/?tab=university", title: /Идеи/ },
  { path: "/search", title: /Поиск/ },
  { path: "/search?tab=people", title: /Поиск/ },
  { path: "/create", title: /Новая идея|Создать/ },
  { path: "/post/p-kanal", title: /Пиво у канала/ },
  { path: "/post/p-analysis", title: /анализу/ },
  { path: "/u/jonas_k", title: /jonas_k/ },
  { path: "/u/mara_t", title: /mara_t/ },
  { path: "/u/jonas_k/follows?tab=followers", title: /jonas_k/ },
  { path: "/messages", title: /Чаты/ },
  { path: "/messages/tobi", title: /tobi/ },
  { path: "/notifications", title: /Уведомления/ },
  { path: "/settings", title: /Настройки/ },
  { path: "/settings/profile", title: /Профиль/ },
  { path: "/settings/privacy", title: /Приватность/ },
  { path: "/settings/notifications", title: /Уведомления/ },
  { path: "/settings/verification", title: /Верификация/ },
  { path: "/settings/blocked", title: /Заблокированные/ },
  { path: "/settings/account", title: /Данные и аккаунт/ },
  { path: "/legal", title: /Документы/ },
  { path: "/legal/impressum", title: /Impressum/ },
  { path: "/legal/privacy", title: /Конфиденциальность/ },
  { path: "/legal/terms", title: /Условия/ },
  { path: "/legal/community", title: /Правила сообщества/ },
  { path: "/auth/login", title: /Вход/ },
  { path: "/auth/signup", title: /Регистрация/ },
  { path: "/auth/forgot", title: /Восстановление пароля/ },
  { path: "/auth/reset", title: /Новый пароль/ },
  { path: "/auth/reset/done", title: /Пароль обновлён/ },
  { path: "/auth/confirm", title: /Ссылка из письма/ },
  { path: "/auth/confirm?token_hash=pkce_0123456789abcdef&type=recovery", title: /Ссылка из письма/ },
  { path: "/auth/check-email", title: /Проверь почту/ },
];

// axe проходит всё дерево: на длинной ленте это дольше стандартных 30 секунд.
test.describe.configure({ timeout: 90_000 });

for (const screen of screens) {
  test(`${screen.path} — открывается, доступен, без ошибок`, async ({ page, consoleErrors }) => {
    const response = await page.goto(screen.path);
    expect(response?.status(), "статус ответа").toBeLessThan(400);
    await expect(page).toHaveTitle(screen.title);
    await expect(page.locator("h1").first()).toBeVisible();

    expect(await accessibilityViolations(page), "нарушения WCAG 2.2 AA").toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "горизонтальная прокрутка").toBeLessThanOrEqual(0);

    expect(consoleErrors, "ошибки в консоли").toEqual([]);
  });
}

test("несуществующая страница — 404 с выходом к идеям", async ({ page }) => {
  const response = await page.goto("/post/no-such-idea");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "К идеям" })).toBeVisible();
});
