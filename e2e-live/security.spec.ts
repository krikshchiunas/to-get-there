import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  accessTokenOf,
  createConfirmedPerson,
  passwordField,
  profileOf,
  restAs,
  signIn,
  type Person,
} from "./helpers";

/**
 * Права держит база, а не экран: здесь запросы идут в API Supabase мимо
 * приложения, с настоящим токеном вошедшего — как из DevTools. Плюс смена
 * пароля, выход на всех устройствах и удаление аккаунта с подтверждением.
 */

async function personIn(browser: Browser, person: Person): Promise<Page> {
  const context = await browser.newContext({ locale: "ru-RU", timezoneId: "Europe/Berlin" });
  const page = await context.newPage();
  await signIn(page, person);
  return page;
}

async function createIdea(page: Page, title: string): Promise<string> {
  await page.goto("/create");
  await page.getByLabel("Название").fill(title);
  await page.getByLabel("Описание").fill("Проверка прав: чужой не должен её менять.");
  await page.getByRole("button", { name: "Спорт" }).click();
  await page.getByText("Указать город", { exact: true }).click();
  await page.getByLabel("Город", { exact: true }).fill("Берлин");
  await page.getByRole("button", { name: "Создать идею" }).click();
  await expect(page).toHaveURL(/\/post\/[0-9a-f-]{36}$/);
  return page.url().split("/post/")[1];
}

test("IDOR: чужую идею и чужой профиль не изменить и через API", async ({ browser }) => {
  const [ownerPerson, attackerPerson] = await Promise.all([
    createConfirmedPerson("victim"),
    createConfirmedPerson("attacker"),
  ]);
  const owner = await personIn(browser, ownerPerson);
  const attacker = await personIn(browser, attackerPerson);
  const title = `Чужая идея ${Date.now().toString(36)}`;
  const postId = await createIdea(owner, title);
  const ownerProfile = await profileOf(ownerPerson.id!);

  const token = await accessTokenOf(attacker.context());

  // Переписать чужую идею: RLS отдаёт «ноль строк изменено».
  const patch = await restAs(token, `posts?id=eq.${postId}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "Взломано" }),
  });
  expect(await patch.json()).toEqual([]);
  // Удалить чужую идею — тоже ничего.
  const remove = await restAs(token, `posts?id=eq.${postId}`, { method: "DELETE" });
  expect(await remove.json()).toEqual([]);
  // Чужой профиль и чужие настройки.
  const bio = await restAs(token, `users?id=eq.${ownerProfile.id}`, {
    method: "PATCH",
    body: JSON.stringify({ bio: "взлом" }),
  });
  expect(await bio.json()).toEqual([]);
  const settings = await restAs(token, `user_settings?user_id=eq.${ownerProfile.id}`);
  expect(await settings.json()).toEqual([]);

  await owner.goto(`/post/${postId}`);
  await expect(owner.getByRole("heading", { name: title })).toBeVisible();

  await owner.context().close();
  await attacker.context().close();
});

test("повышение прав через API: ни «Личность подтверждена», ни вуз, ни чужой аккаунт", async ({
  browser,
}) => {
  const person = await createConfirmedPerson("escalate", "example.org");
  const victim = await createConfirmedPerson("someone");
  const page = await personIn(browser, person);
  const token = await accessTokenOf(page.context());
  const me = await profileOf(person.id!);

  for (const change of [
    { is_verified: true },
    { university_id: (await profileOf(victim.id!)).university_id },
    { auth_user_id: victim.id },
  ]) {
    const response = await restAs(token, `users?id=eq.${me.id}`, {
      method: "PATCH",
      body: JSON.stringify(change),
    });
    expect(response.status, JSON.stringify(change)).toBeGreaterThanOrEqual(400);
  }
  // Профиль в обход аккаунта не удалить (только delete_my_account).
  const remove = await restAs(token, `users?id=eq.${me.id}`, { method: "DELETE" });
  expect(remove.status).toBeGreaterThanOrEqual(400);
  // Политику регистрации из API не видно вовсе.
  const policy = await restAs(token, "registration_policy?select=mode");
  expect(policy.status).toBeGreaterThanOrEqual(400);

  expect((await profileOf(person.id!)).university_id).toBeNull();
  await page.context().close();
});

test("выход на всех устройствах: другое устройство теряет и экран, и доступ к базе сразу", async ({
  browser,
}) => {
  const person = await createConfirmedPerson("everywhere");
  const phone = await personIn(browser, person);
  const laptop = await personIn(browser, person);

  const phoneToken = await accessTokenOf(phone.context());
  const before = await restAs(phoneToken, "notifications?select=id&limit=1");
  expect(before.status).toBe(200);
  const ownBefore = await restAs(phoneToken, `users?auth_user_id=eq.${person.id}&select=id`);
  expect(await ownBefore.json()).toHaveLength(1);

  await laptop.goto("/settings/security");
  await laptop.getByRole("button", { name: "Выйти на всех устройствах" }).click();
  await expect(laptop).toHaveURL(/\/auth\/login\?signed_out=all/);
  await expect(laptop.getByText("Ты вышел на всех устройствах.")).toBeVisible();

  // Экран телефона: следующий переход — на вход.
  await phone.goto("/settings");
  await expect(phone).toHaveURL(/\/auth\/login/);

  // А его старый access-токен ещё не истёк по сроку — но база его уже не
  // признаёт (0043): ни своего профиля, ни записи.
  const ownAfter = await restAs(phoneToken, `users?auth_user_id=eq.${person.id}&select=id`);
  expect(await ownAfter.json()).toEqual([]);
  // Подписка на человека из сида — запись, которой мешает только отозванная
  // сессия (до 0043 этот запрос проходил: 201).
  const write = await restAs(phoneToken, "follows", {
    method: "POST",
    body: JSON.stringify({
      follower_id: (await profileOf(person.id!)).id,
      following_id: "33333333-3333-3333-3333-000000000002",
    }),
  });
  expect([401, 403]).toContain(write.status);

  await phone.context().close();
  await laptop.context().close();
});

test("смена пароля: нужен текущий, другие устройства выходят, старый пароль больше не подходит", async ({
  browser,
}) => {
  const person = await createConfirmedPerson("change");
  const page = await personIn(browser, person);
  const other = await personIn(browser, person);
  const fresh = `${person.password}-changed`;

  await page.goto("/settings/security");
  await page.getByLabel("Текущий пароль").fill("not my password");
  await passwordField(page, "Новый пароль").fill(fresh);
  await page.getByLabel("Новый пароль ещё раз").fill(fresh);
  await page.getByRole("button", { name: "Сменить пароль" }).click();
  await expect(page.locator("#current-error")).toHaveText("Текущий пароль не подходит.");
  await expect(page.getByLabel("Текущий пароль")).toBeFocused();

  await page.getByLabel("Текущий пароль").fill(person.password);
  await passwordField(page, "Новый пароль").fill(fresh);
  await page.getByLabel("Новый пароль ещё раз").fill(fresh);
  await page.getByRole("button", { name: "Сменить пароль" }).click();
  await expect(page.getByText(/Пароль изменён/)).toBeVisible();

  // Это устройство осталось внутри, другое — вышло.
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/notifications$/);
  await other.goto("/notifications");
  await expect(other).toHaveURL(/\/auth\/login/);

  // Старый пароль — нет, новый — да.
  const check = await (await browser.newContext()).newPage();
  await check.goto("/auth/login");
  await check.getByLabel("Почта").fill(person.email);
  await passwordField(check).fill(person.password);
  await check.getByRole("button", { name: "Войти" }).click();
  await expect(check.getByText("Неверная почта или пароль.")).toBeVisible();
  await signIn(check, { ...person, password: fresh });

  await Promise.all([page.context().close(), other.context().close(), check.context().close()]);
});

test("подбор пароля изнутри сессии: шестая попытка за 15 минут — «слишком много»", async ({ browser }) => {
  const person = await createConfirmedPerson("guess");
  const page = await personIn(browser, person);
  await page.goto("/settings/security");

  for (let attempt = 1; attempt <= 6; attempt++) {
    await page.getByLabel("Текущий пароль").fill(`guess-${attempt}-password`);
    await passwordField(page, "Новый пароль").fill("brand new password");
    await page.getByLabel("Новый пароль ещё раз").fill("brand new password");
    await page.getByRole("button", { name: "Сменить пароль" }).click();
    if (attempt < 6) await expect(page.locator("#current-error")).toHaveText("Текущий пароль не подходит.");
  }
  await expect(page.getByText(/Слишком много попыток/)).toBeVisible();

  // Даже верный пароль сейчас не проверяется — лимит общий на аккаунт.
  await page.getByLabel("Текущий пароль").fill(person.password);
  await passwordField(page, "Новый пароль").fill("brand new password");
  await page.getByLabel("Новый пароль ещё раз").fill("brand new password");
  await page.getByRole("button", { name: "Сменить пароль" }).click();
  await expect(page.getByText(/Слишком много попыток/)).toBeVisible();
  await page.context().close();
});

test("удаление аккаунта: ник и пароль; после — ни входа, ни данных", async ({ browser }) => {
  const person = await createConfirmedPerson("delete");
  const page = await personIn(browser, person);

  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Удалить аккаунт" }).click();
  const sheet = page.getByRole("dialog", { name: "Удалить аккаунт навсегда?" });
  await sheet.getByLabel("Ник").fill(person.nickname!);
  await passwordField(page).fill("not my password");
  await sheet.getByRole("button", { name: "Удалить аккаунт" }).click();
  await expect(sheet.getByText("Пароль не подходит.")).toBeVisible();

  await passwordField(page).fill(person.password);
  await sheet.getByRole("button", { name: "Удалить аккаунт" }).click();
  await expect(page).toHaveURL(/\/auth\/login\?deleted=1/);

  const check = await (await browser.newContext()).newPage();
  await check.goto("/auth/login");
  await check.getByLabel("Почта").fill(person.email);
  await passwordField(check).fill(person.password);
  await check.getByRole("button", { name: "Войти" }).click();
  await expect(check.getByText("Неверная почта или пароль.")).toBeVisible();

  await Promise.all([page.context().close(), check.context().close()]);
});
