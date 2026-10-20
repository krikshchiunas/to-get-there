import { expect, test } from "./fixtures";

/**
 * Чат идеи и личка: действия с сообщением, ответ, жалоба — с клавиатуры и
 * с возвратом фокуса, как требует WCAG 2.4.3. Демо-режим не пишет в базу,
 * поэтому отправка честно говорит об этом, а экран откатывается.
 */
test.describe("чат идеи", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/post/p-kanal");
  });

  test("ответ показывает цитату и ведёт к исходному", async ({ page }) => {
    const quote = page.getByRole("button", { name: /Ответ на сообщение/ }).first();
    await expect(quote).toBeVisible();
    await quote.click();
    await expect(page.locator("li.bg-sunken")).toHaveCount(1);
  });

  test("«⋯» открывает действия; Esc закрывает и возвращает фокус", async ({ page }) => {
    const more = page.getByRole("button", { name: "Действия с сообщением от jonas_k" }).first();
    await more.focus();
    await page.keyboard.press("Enter");

    const sheet = page.getByRole("dialog", { name: /Сообщение от jonas_k/ });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Ответить" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Пожаловаться" })).toBeVisible();
    // Чужое сообщение участник не удаляет — пункта нет.
    await expect(sheet.getByRole("button", { name: "Удалить сообщение" })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();
  });

  test("«Ответить» ставит курсор в поле с полоской ответа, Esc её снимает", async ({ page }) => {
    await page.getByRole("button", { name: "Действия с сообщением от tobi" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Ответить" }).click();

    const field = page.getByLabel("Ответ для tobi");
    await expect(field).toBeFocused();
    await expect(page.getByText("Ответ tobi")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Сообщение в чат")).toBeVisible();
  });

  test("жалоба: без причины не отправить, с причиной — можно", async ({ page }) => {
    await page.getByRole("button", { name: "Действия с сообщением от tobi" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Пожаловаться" }).click();

    const report = page.getByRole("dialog", { name: /Пожаловаться на сообщение/ });
    const submit = report.getByRole("button", { name: "Отправить жалобу" });
    await expect(submit).toBeDisabled();

    await report.getByText("Спам или реклама").click();
    await expect(submit).toBeEnabled();

    await report.getByText("Другое", { exact: true }).click();
    await expect(submit, "«Другое» требует пояснения").toBeDisabled();
    await report.getByLabel(/Подробности/).fill("Продаёт билеты втридорога");
    await expect(submit).toBeEnabled();
  });

  test("отправка в демо-режиме откатывается и объясняет почему", async ({ page }) => {
    const field = page.getByLabel("Сообщение в чат");
    await field.fill("Возьму плед");
    await field.press("Enter");
    await expect(page.getByText("Это демо без базы: изменения не сохраняются.")).toBeVisible();
    await expect(page.getByText("Возьму плед")).toHaveCount(0);
  });
});

test.describe("личка", () => {
  test("у своего сообщения — «Удалить у обоих», у чужого — «Пожаловаться»", async ({ page }) => {
    await page.goto("/messages/tobi");
    await page.getByRole("button", { name: "Действия с твоим сообщением" }).first().click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Удалить у обоих" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Действия с сообщением", exact: true }).first().click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Пожаловаться" })).toBeVisible();
  });
});
