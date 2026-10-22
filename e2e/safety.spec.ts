import { expect, test } from "./fixtures";

/** Профиль, блокировка, удаление аккаунта и документы — то, что видит человек. */
test("в чужом профиле есть «Заблокировать» с объяснением последствий", async ({ page }) => {
  await page.goto("/u/jonas_k");
  await page.getByRole("button", { name: "Ещё о jonas_k" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Заблокировать" }).click();

  const confirm = page.getByRole("dialog", { name: "Заблокировать jonas_k?" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText("не узнает о блокировке", { exact: false })).toBeVisible();
  await confirm.getByRole("button", { name: "Отмена" }).click();
  await expect(confirm).toBeHidden();
});

test("удаление аккаунта требует набрать ник и пароль", async ({ page }) => {
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Удалить аккаунт" }).click();

  const confirm = page.getByRole("dialog", { name: "Удалить аккаунт навсегда?" });
  const remove = confirm.getByRole("button", { name: "Удалить аккаунт" });
  await expect(remove).toBeDisabled();
  await confirm.getByLabel("Ник").fill("не тот ник");
  await expect(remove).toBeDisabled();
  await confirm.getByLabel("Ник").fill("mara_t");
  // Ник верный, но без пароля открытая сессия аккаунт не удалит.
  await expect(remove).toBeDisabled();
  await confirm.getByLabel("Пароль", { exact: true }).fill("любой пароль");
  await expect(remove).toBeEnabled();
});

test("ссылка «Перейти к содержанию» — первая остановка Tab", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Перейти к содержанию" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#content")).toBeFocused();
});

test("регистрация показывает условия и возраст", async ({ page }) => {
  await page.goto("/auth/signup");
  await expect(page.getByText(/Мне есть 16/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Мне есть 16/ })).not.toBeChecked();
  await expect(page.getByRole("link", { name: "условия", exact: true })).toHaveAttribute(
    "href",
    "/legal/terms",
  );
});

test("служебные адреса отвечают", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ status: "ok" });

  const manifest = await request.get("/manifest.webmanifest");
  expect((await manifest.json()).name).toBe("To Get There");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /");
});
