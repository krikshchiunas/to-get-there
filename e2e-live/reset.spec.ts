import { expect, test, type Page } from "@playwright/test";
import {
  alertIn,
  createConfirmedPerson,
  linkFromMail,
  passwordField,
  signIn,
  signOut,
  type Person,
} from "./helpers";

/**
 * Сброс пароля: письмо, ссылка, новый пароль. И то, чего быть не должно:
 * формы нового пароля без ссылки и входа со старым паролем после сброса.
 */

async function requestReset(page: Page, person: Person): Promise<number> {
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Забыли пароль?" }).click();
  await expect(page).toHaveURL(/\/auth\/forgot$/);
  await page.getByLabel("Почта").fill(person.email);
  const since = Date.now();
  await page.getByRole("button", { name: "Прислать ссылку" }).click();
  await expect(page).toHaveURL(/\/auth\/check-email\?reason=reset/);
  return since;
}

async function setNewPassword(page: Page, password: string): Promise<void> {
  await expect(page).toHaveURL(/\/auth\/reset$/);
  await expect(page.getByRole("heading", { name: "Новый пароль" })).toBeVisible();
  await passwordField(page, "Новый пароль").fill(password);
  await page.getByLabel("Ещё раз").fill(password);
  await page.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(page).toHaveURL(/\/auth\/reset\/done$/);
  await expect(page.getByRole("heading", { name: "Пароль обновлён" })).toBeVisible();
}

async function loginFails(page: Page, person: Person): Promise<void> {
  await page.goto("/auth/login");
  await page.getByLabel("Почта").fill(person.email);
  await passwordField(page).fill(person.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(alertIn(page)).toHaveText("Неверная почта или пароль.");
}

test("сброс в том же браузере: ссылка из письма, новый пароль, старый больше не подходит", async ({
  page,
}) => {
  const person = await createConfirmedPerson("reset");
  const since = await requestReset(page, person);

  await page.goto(await linkFromMail(person.email, since));
  const fresh = `${person.password}-new`;

  // Несовпадающий повтор — ошибка на месте, а не «готово».
  await expect(page).toHaveURL(/\/auth\/reset$/);
  // Форма говорит, какой аккаунт меняет, и подсказывает его менеджеру паролей.
  await expect(page.getByText(person.email)).toBeVisible();
  await expect(page.locator('input[autocomplete="username"]')).toHaveValue(person.email);
  await passwordField(page, "Новый пароль").fill(fresh);
  await page.getByLabel("Ещё раз").fill(`${fresh}!`);
  await page.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(page.locator("#repeat-error")).toHaveText("Пароли не совпадают.");

  await setNewPassword(page, fresh);
  await page.getByRole("link", { name: "В приложение" }).click();
  await expect(page).toHaveTitle(/Идеи/);

  await signOut(page);
  await loginFails(page, person);
  await signIn(page, { ...person, password: fresh });
});

test("сброс с другого устройства: ссылка token_hash без cookie того браузера", async ({ page, browser }) => {
  const person = await createConfirmedPerson("device");
  const since = await requestReset(page, person);

  // Письмо открывают на телефоне: другой браузер, ни одной cookie.
  const verify = new URL(await linkFromMail(person.email, since));
  const tokenHash = verify.searchParams.get("token");
  expect(tokenHash, "token в ссылке письма").toBeTruthy();

  const phone = await browser.newContext();
  const other = await phone.newPage();
  await other.goto(`/auth/confirm?token_hash=${tokenHash}&type=recovery`);
  const fresh = `${person.password}-phone`;
  await setNewPassword(other, fresh);
  await phone.close();

  await loginFails(page, person);
  await signIn(page, { ...person, password: fresh });
});

test("форма нового пароля не открывается без ссылки — даже вошедшему", async ({ page }) => {
  const person = await createConfirmedPerson("noreset");
  await signIn(page, person);

  await page.goto("/auth/reset");
  await expect(page.getByRole("heading", { name: "Ссылка устарела" })).toBeVisible();
  await expect(passwordField(page, "Новый пароль")).toHaveCount(0);
});

test("использованная ссылка второй раз не срабатывает", async ({ page }) => {
  const person = await createConfirmedPerson("reuse");
  const since = await requestReset(page, person);
  const link = await linkFromMail(person.email, since);

  await page.goto(link);
  await setNewPassword(page, `${person.password}-once`);

  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/auth\/(forgot\?error=link|login)/);
});

test("на неизвестную почту ответ тот же — форма не выдаёт, кто зарегистрирован", async ({ page }) => {
  await page.goto("/auth/forgot");
  await page.getByLabel("Почта").fill(`e2e.nobody.${Date.now()}@tu-berlin.de`);
  await page.getByRole("button", { name: "Прислать ссылку" }).click();
  await expect(page).toHaveURL(/\/auth\/check-email\?reason=reset/);
  await expect(page.getByText("Если есть аккаунт с почтой")).toBeVisible();
});

test("повторный запрос сброса в ту же минуту — тот же ответ, есть аккаунт или нет", async ({ page }) => {
  // Раньше второй запрос на существующую почту отвечал «письмо уже
  // отправлено», а на несуществующую — «проверь почту»: по разнице было
  // видно, кто зарегистрирован.
  const person = await createConfirmedPerson("twice");
  await requestReset(page, person);
  await requestReset(page, person);
  await expect(page.getByText("Если есть аккаунт с почтой")).toBeVisible();
  expect(page.url()).not.toContain(encodeURIComponent(person.email));
});

test("смена пароля по ссылке выкидывает другие устройства", async ({ page, browser }) => {
  const person = await createConfirmedPerson("kick");
  const laptop = await browser.newContext();
  const other = await laptop.newPage();
  await signIn(other, person);

  const since = await requestReset(page, person);
  await page.goto(await linkFromMail(person.email, since));
  await setNewPassword(page, `${person.password}-kick`);

  await other.goto("/settings");
  await expect(other).toHaveURL(/\/auth\/login/);
  await laptop.close();
});
