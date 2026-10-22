import { expect } from "@playwright/test";
import {
  alertIn,
  createConfirmedPerson,
  linkFromMail,
  loginFails,
  newDevice,
  requestReset,
  setNewPassword,
  signIn,
  signOut,
  test,
} from "./helpers";

/**
 * Сброс пароля: письмо, ссылка, новый пароль. И то, чего быть не должно:
 * формы нового пароля без ссылки и входа со старым паролем после сброса.
 */

test("сброс в том же браузере: ссылка из письма, новый пароль, старый больше не подходит", async ({
  page,
}) => {
  const person = await createConfirmedPerson("reset");
  const since = await requestReset(page, person);

  await page.goto(await linkFromMail(person.email, since));
  const fresh = `${person.password}-new`;

  // Несовпадающий повтор — ошибка на месте, а не «готово».
  await expect(page).toHaveURL(/\/auth\/reset$/);
  await page.getByLabel("Новый пароль").fill(fresh);
  await page.getByLabel("Ещё раз").fill(`${fresh}!`);
  await page.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(alertIn(page)).toHaveText("Пароли не совпадают.");

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

  const phone = await newDevice(browser);
  const other = await phone.newPage();
  await other.goto(`/auth/confirm?token_hash=${tokenHash}&type=recovery`);
  // Вход по ссылке — только по кнопке: GET ничего не меняет (почтовые сканеры).
  await other.getByRole("button", { name: "Задать новый пароль" }).click();
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
  await expect(page.getByLabel("Новый пароль")).toHaveCount(0);
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
  await page.getByLabel("Почта", { exact: true }).fill(`e2e.nobody.${Date.now()}@tu-berlin.de`);
  await page.getByRole("button", { name: "Прислать ссылку" }).click();
  await expect(page).toHaveURL(/\/auth\/check-email\?reason=reset/);
  await expect(page.getByText("Если есть аккаунт с почтой")).toBeVisible();
});
