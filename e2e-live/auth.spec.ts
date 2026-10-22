import { expect } from "@playwright/test";
import {
  alertIn,
  createConfirmedPerson,
  expireSession,
  fillLogin,
  linkFromMail,
  newPerson,
  nicknameOf,
  signIn,
  signOut,
  submitSignUp,
  test,
} from "./helpers";

/**
 * Вход как он есть: регистрация с подтверждением почты, выход, закрытые
 * экраны, неверный пароль, возврат туда, откуда увели, и истёкшая сессия.
 */

test("регистрация по почте вуза: письмо, ссылка — и человек внутри, с вузом в профиле", async ({ page }) => {
  const person = newPerson("signup");
  const since = await submitSignUp(page, person);

  await expect(page).toHaveURL(/\/auth\/check-email/);
  await expect(page.getByRole("heading", { name: "Проверь почту" })).toBeVisible();

  await page.goto(await linkFromMail(person.email, since));
  await expect(page).toHaveURL(/localhost:3000\/$/);
  await expect(page).toHaveTitle(/Идеи/);

  // Профиль создал мост регистрации (0013/0043): ник из адреса, вуз по домену.
  await page.goto("/settings/profile");
  await expect(page.getByLabel("Ник")).toHaveValue(nicknameOf(person));
  await expect(page.getByText("Технический университет Берлина").first()).toBeVisible();
});

test("регистрация открыта любой почте: профиль без вуза и лента «Все»", async ({ page }) => {
  const person = newPerson("open", "gmail.com");
  const since = await submitSignUp(page, person);
  await expect(page).toHaveURL(/\/auth\/check-email$/);
  // Адреса нет в строке запроса — он в httpOnly cookie (lib/auth/pending-email.ts).
  await expect(page.getByText(person.email)).toBeVisible();

  await page.goto(await linkFromMail(person.email, since));
  await expect(page).toHaveTitle(/Идеи/);
  await expect(page.getByRole("link", { name: "Все" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Университет" })).toHaveCount(0);

  await page.goto("/settings/profile");
  await expect(page.getByText("Без вуза").first()).toBeVisible();
});

test("без входа экраны закрыты, после входа — возврат на тот же экран", async ({ page }) => {
  const person = await createConfirmedPerson("next");

  await page.goto("/messages");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fmessages/);

  await fillLogin(page, person);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/messages$/);
});

test("неверный пароль — понятная ошибка, почта остаётся в поле", async ({ page }) => {
  const person = await createConfirmedPerson("wrong");

  await page.goto("/auth/login");
  await fillLogin(page, { ...person, password: `${person.password}-nope` });
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(alertIn(page)).toHaveText("Неверная почта или пароль.");
  await expect(page.getByLabel("Почта", { exact: true })).toHaveValue(person.email);
  // Фокус — в поле, где ошибку исправлять (lib/auth/credentials.ts → field).
  await expect(page.getByLabel("Пароль", { exact: true })).toBeFocused();
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
  await fillLogin(page, person);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
