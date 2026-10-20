import { expect, test } from "@playwright/test";
import {
  alertIn,
  createConfirmedPerson,
  expireSession,
  linkFromMail,
  newPerson,
  nicknameOf,
  signIn,
  signOut,
} from "./helpers";

/**
 * Вход как он есть: регистрация с подтверждением почты, выход, закрытые
 * экраны, неверный пароль, возврат туда, откуда увели, и истёкшая сессия.
 */

test("регистрация по университетской почте: письмо, ссылка — и человек внутри", async ({ page }) => {
  const person = newPerson("signup");

  await page.goto("/auth/signup");
  await page.getByLabel("Университетская почта").fill(person.email);
  await page.getByLabel("Пароль").fill(person.password);
  const since = Date.now();
  await page.getByRole("button", { name: "Создать аккаунт" }).click();

  await expect(page).toHaveURL(/\/auth\/check-email/);
  await expect(page.getByRole("heading", { name: "Проверь почту" })).toBeVisible();

  await page.goto(await linkFromMail(person.email, since));
  await expect(page).toHaveURL(/localhost:3000\/$/);
  await expect(page).toHaveTitle(/Идеи/);

  // Профиль создал мост 0013: ник из адреса, университет по домену.
  await page.goto("/settings/profile");
  await expect(page.getByLabel("Ник")).toHaveValue(nicknameOf(person));
  await expect(page.getByText("Технический университет Берлина").first()).toBeVisible();
});

test("чужой домен регистрацию не проходит", async ({ page }) => {
  await page.goto("/auth/signup");
  await page.getByLabel("Университетская почта").fill(`e2e.${Date.now()}@gmail.com`);
  await page.getByLabel("Пароль").fill("long-enough-password");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(alertIn(page)).toContainText(/не относится ни к одному университету|не принимается/);
  await expect(page).toHaveURL(/\/auth\/signup/);
});

test("без входа экраны закрыты, после входа — возврат на тот же экран", async ({ page }) => {
  const person = await createConfirmedPerson("next");

  await page.goto("/messages");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fmessages/);

  await page.getByLabel("Почта").fill(person.email);
  await page.getByLabel("Пароль").fill(person.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/messages$/);
});

test("неверный пароль — понятная ошибка, почта остаётся в поле", async ({ page }) => {
  const person = await createConfirmedPerson("wrong");

  await page.goto("/auth/login");
  await page.getByLabel("Почта").fill(person.email);
  await page.getByLabel("Пароль").fill(`${person.password}-nope`);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(alertIn(page)).toHaveText("Неверная почта или пароль.");
  await expect(page.getByLabel("Почта")).toHaveValue(person.email);
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("выход закрывает приложение, вошедшему форма входа не показывается", async ({ page }) => {
  const person = await createConfirmedPerson("logout");
  await signIn(page, person);

  await page.goto("/auth/login");
  await expect(page).toHaveURL(/localhost:3000\/$/);

  await signOut(page);
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fnotifications/);
});

test("истёкшая сессия, которую не продлить, ведёт на вход, а не в ошибку", async ({ page, context }) => {
  const person = await createConfirmedPerson("expired");
  await signIn(page, person);
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();

  await expireSession(context);

  const response = await page.goto("/settings");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fsettings/);

  // И войти снова можно с тем же паролем.
  await page.getByLabel("Почта").fill(person.email);
  await page.getByLabel("Пароль").fill(person.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
