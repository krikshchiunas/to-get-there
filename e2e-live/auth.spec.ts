import { expect, test, type Page } from "@playwright/test";
import {
  alertIn,
  createConfirmedPerson,
  expireSession,
  linkFromMail,
  newPerson,
  passwordField,
  signIn,
  signOut,
  type Person,
} from "./helpers";

/**
 * Вход как он есть: регистрация с подтверждением почты, выход, закрытые
 * экраны, неверный пароль, возврат туда, откуда увели, истёкшая сессия,
 * несколько вкладок — и то, чего форма не должна выдавать.
 */

async function fillSignup(page: Page, person: Person): Promise<void> {
  await page.getByLabel("Почта").fill(person.email);
  await passwordField(page).fill(person.password);
  await page.getByLabel("Пароль ещё раз").fill(person.password);
  await page.getByRole("checkbox", { name: /Мне есть 16/ }).check();
}

test("регистрация открыта для любой почты: письмо, ссылка — и человек внутри, без вуза", async ({ page }) => {
  const person = newPerson("signup", "example.org");

  await page.goto("/auth/signup");
  await fillSignup(page, person);
  const since = Date.now();
  await page.getByRole("button", { name: "Создать аккаунт" }).click();

  await expect(page).toHaveURL(/\/auth\/check-email$/);
  await expect(page.getByRole("heading", { name: "Проверь почту" })).toBeVisible();
  // Почта — на экране (из httpOnly-cookie), но не в адресной строке.
  await expect(page.getByText(person.email)).toBeVisible();
  expect(page.url()).not.toContain(encodeURIComponent(person.email));
  expect(page.url()).not.toContain("example.org");

  await page.goto(await linkFromMail(person.email, since));
  await expect(page).toHaveURL(/localhost:3000\/$/);
  await expect(page).toHaveTitle(/Идеи/);

  // Профиль создал триггер регистрации: ник случайный, из почты ничего не взято.
  await page.goto("/settings/profile");
  const nickname = await page.getByLabel("Ник").inputValue();
  expect(nickname).toMatch(/^user[0-9a-f]{8}$/);
  expect(nickname).not.toContain("signup");
  await expect(page.getByText("Вуз не подтверждён").first()).toBeVisible();

  // Лента «Университет» честно объясняет, почему пуста.
  await page.goto("/?tab=university");
  await expect(page.getByRole("heading", { name: "Лента вуза — для университетской почты" })).toBeVisible();
});

test("почта вуза по-прежнему даёт вуз", async ({ page }) => {
  const person = await createConfirmedPerson("campus");
  await signIn(page, person);
  await page.goto("/settings/profile");
  await expect(page.getByText("Технический университет Берлина").first()).toBeVisible();
});

test("без согласия с условиями и с несовпавшим повтором аккаунт не создаётся", async ({ page }) => {
  const person = newPerson("noterms", "example.org");
  await page.goto("/auth/signup");
  await page.getByLabel("Почта").fill(person.email);
  await passwordField(page).fill(person.password);
  await page.getByLabel("Пароль ещё раз").fill(`${person.password}!`);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();

  await expect(page.locator("#repeat-error")).toHaveText("Пароли не совпадают.");
  await expect(page.locator("#terms-error")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/signup$/);
});

test("занятая почта при регистрации — тот же ответ, что и свободная", async ({ page }) => {
  const existing = await createConfirmedPerson("taken", "example.org");

  await page.goto("/auth/signup");
  await fillSignup(page, { ...existing, password: "another long password" });
  await page.getByRole("button", { name: "Создать аккаунт" }).click();

  // Ни «аккаунт уже есть», ни ошибки — «проверь почту», как всем.
  await expect(page).toHaveURL(/\/auth\/check-email$/);
  await expect(page.getByRole("heading", { name: "Проверь почту" })).toBeVisible();

  // И старый пароль по-прежнему подходит: регистрация его не перезаписала.
  await signIn(page, existing);
});

test("письмо подтверждения ещё раз; вход до подтверждения объясняет, что делать", async ({ page }) => {
  test.setTimeout(150_000);
  const person = newPerson("resend", "example.org");
  await page.goto("/auth/signup");
  await fillSignup(page, person);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(page).toHaveURL(/\/auth\/check-email$/);

  // Supabase отправляет одному адресу не чаще раза в минуту — ждём честно.
  await page.waitForTimeout(61_000);
  const since = Date.now();
  await page.getByRole("button", { name: "Отправить письмо ещё раз" }).click();
  await expect(page.getByText(/новое письмо уже в пути/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Отправить ещё раз можно через/ })).toBeDisabled();
  const link = await linkFromMail(person.email, since);

  // Вход до подтверждения: пароль верный — предлагаем письмо, а не «неверно».
  await page.goto("/auth/login");
  await page.getByLabel("Почта").fill(person.email);
  await passwordField(page).fill(person.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(alertIn(page).filter({ hasText: "Почта ещё не подтверждена" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Отправить письмо ещё раз" })).toBeVisible();

  // Новая ссылка работает.
  await page.goto(link);
  await expect(page).toHaveURL(/localhost:3000\/$/);
});

test("ссылка подтверждения второй раз: вошедшему — в приложение, остальным — объяснение", async ({
  page,
  browser,
}) => {
  const person = newPerson("twice", "example.org");
  await page.goto("/auth/signup");
  await fillSignup(page, person);
  const since = Date.now();
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  const link = await linkFromMail(person.email, since);

  await page.goto(link);
  await expect(page).toHaveURL(/localhost:3000\/$/);
  // Та же ссылка в том же браузере: Auth отвечает «устарела» во фрагменте
  // адреса, но человек и так внутри — он остаётся в приложении.
  await page.goto(link);
  await expect(page).toHaveURL(/localhost:3000\/(#.*)?$/);
  await expect(page).toHaveTitle(/Идеи/);

  // В другом браузере — вход с объяснением, а не немая форма.
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  await expect(other).toHaveURL(/\/auth\/login/);
  await expect(other.getByText(/устарела или уже использована/)).toBeVisible();
  // Фрагмент с ошибкой убран из адресной строки.
  expect(new URL(other.url()).hash).toBe("");
  await other.context().close();
});

test("без входа экраны закрыты, после входа — возврат на тот же экран", async ({ page }) => {
  const person = await createConfirmedPerson("next");

  await page.goto("/messages");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fmessages/);

  await page.getByLabel("Почта").fill(person.email);
  await passwordField(page).fill(person.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/messages$/);
});

test("открытый редирект: next=https://evil.example после входа ведёт на главную", async ({ page }) => {
  const person = await createConfirmedPerson("evil");
  await page.goto(`/login?next=${encodeURIComponent("https://evil.example/messages")}`);
  await page.getByLabel("Почта").fill(person.email);
  await passwordField(page).fill(person.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/$/);
});

test("неверный пароль — понятная ошибка, почта остаётся в поле; несуществующая почта — та же ошибка", async ({
  page,
}) => {
  const person = await createConfirmedPerson("wrong");

  await page.goto("/auth/login");
  await page.getByLabel("Почта").fill(person.email);
  await passwordField(page).fill(`${person.password}-nope`);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(alertIn(page)).toHaveText("Неверная почта или пароль.");
  await expect(alertIn(page)).toBeFocused();
  await expect(page.getByLabel("Почта")).toHaveValue(person.email);
  await expect(page).toHaveURL(/\/auth\/login/);

  await page.getByLabel("Почта").fill(`e2e.nobody.${Date.now()}@tu-berlin.de`);
  await passwordField(page).fill("whatever password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(alertIn(page)).toHaveText("Неверная почта или пароль.");
});

test("сессия переживает перезагрузку и «перезапуск браузера»", async ({ page, browser }) => {
  const person = await createConfirmedPerson("persist");
  await signIn(page, person);
  await page.goto("/settings");
  await page.reload();
  await expect(page).toHaveURL(/\/settings$/);

  // Новый контекст с теми же cookie — как браузер после перезапуска.
  const state = await page.context().storageState();
  const restarted = await browser.newContext({ storageState: state });
  const again = await restarted.newPage();
  await again.goto("/notifications");
  await expect(again).toHaveURL(/\/notifications$/);
  await restarted.close();
});

test("выход: обновление и прямой адрес — снова вход; вошедшему форма входа не показывается", async ({
  page,
}) => {
  const person = await createConfirmedPerson("logout");
  await signIn(page, person);

  await page.goto("/auth/login");
  await expect(page).toHaveURL(/localhost:3000\/$/);

  await page.goto("/messages");
  await signOut(page);
  await expect(page.getByText("Ты вышел из аккаунта.")).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fmessages/);
  await page.goBack();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("выход в одной вкладке уводит на вход и другую", async ({ page }) => {
  const person = await createConfirmedPerson("tabs");
  await signIn(page, person);

  const second = await page.context().newPage();
  await second.goto("/notifications");
  await expect(second).toHaveURL(/\/notifications$/);

  await signOut(page);
  await expect(second).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
});

test("истёкшая сессия, которую не продлить, ведёт на вход, а не в ошибку", async ({ page, context }) => {
  const person = await createConfirmedPerson("expired");
  await signIn(page, person);
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();

  await expireSession(context);

  const response = await page.goto("/settings");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fsettings&expired=1/);
  await expect(page.getByText(/Сессия закончилась/)).toBeVisible();

  // И войти снова можно с тем же паролем.
  await page.getByLabel("Почта").fill(person.email);
  await passwordField(page).fill(person.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
