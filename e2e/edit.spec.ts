import { expect, test } from "./fixtures";

/** Правка идеи: форма открывается с текущими значениями и сохраняет их, а не создаёт новую. */
test("автор открывает правку с заполненными полями", async ({ page }) => {
  await page.goto("/post/p-ostbloc");
  await page.getByRole("button", { name: "Ещё об идее" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Редактировать идею" }).click();

  await expect(page).toHaveURL(/\/post\/p-ostbloc\/edit$/);
  await expect(page.getByLabel("Название")).not.toHaveValue("");
  await expect(page.getByRole("button", { name: "Сохранить" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать идею" })).toHaveCount(0);
});

test("чужую идею правкой не открыть", async ({ page }) => {
  const response = await page.goto("/post/p-kanal/edit");
  expect(response?.status()).toBe(404);
});
