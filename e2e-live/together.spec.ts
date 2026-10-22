import { expect, type Browser, type Page } from "@playwright/test";
import { createConfirmedPerson, newDevice, nicknameOf, signIn, test, type Person } from "./helpers";

/**
 * Двое в одном вузе: автор заводит идею, второй находит её, вступает и
 * пишет в чат — автор видит сообщение без перезагрузки, и обратно. Плюс
 * права: чужую идею не открыть правкой, скрытые интересы не видны.
 */

async function personIn(browser: Browser, person: Person): Promise<Page> {
  const context = await newDevice(browser);
  const page = await context.newPage();
  await signIn(page, person);
  return page;
}

async function createIdea(page: Page, title: string): Promise<string> {
  await page.goto("/create");
  await page.getByLabel("Название").fill(title);
  await page.getByLabel("Описание").fill("Проверка E2E: двое в одном чате, сообщения в реальном времени.");
  await page.getByRole("button", { name: "Спорт" }).click();
  // Город — самый короткий путь: без карты и геолокации. Сама радиокнопка
  // визуально скрыта, нажимают на строку с подписью.
  await page.getByText("Указать город", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Указать город/ })).toBeChecked();
  await page.getByLabel("Город", { exact: true }).fill("Берлин");
  await page.getByRole("button", { name: "Создать идею" }).click();

  await expect(page).toHaveURL(/\/post\/[0-9a-f-]{36}$/);
  return page.url().split("/post/")[1];
}

async function send(page: Page, text: string): Promise<void> {
  const composer = page.locator("#chat-composer");
  await composer.fill(text);
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(composer).toHaveValue("");
}

test("идея на двоих: вступление, чат в реальном времени, уведомление автору", async ({ browser }) => {
  const [authorPerson, guestPerson] = await Promise.all([
    createConfirmedPerson("author"),
    createConfirmedPerson("guest"),
  ]);
  const author = await personIn(browser, authorPerson);
  const guest = await personIn(browser, guestPerson);

  const title = `E2E вдвоём ${Date.now().toString(36)}`;
  const postId = await createIdea(author, title);

  // Идея в ленте вуза у второго человека.
  await guest.goto("/?tab=university");
  await expect(guest.getByText(title)).toBeVisible();

  // Чужой — пока не вступил, писать нельзя.
  await guest.goto(`/post/${postId}`);
  await expect(guest.locator("#chat-composer")).toHaveCount(0);
  await guest.getByRole("button", { name: "Присоединиться" }).click();
  await expect(guest.locator("#chat-composer")).toBeVisible();

  // Автор держит чат открытым — сообщение приходит без перезагрузки.
  await author.goto(`/post/${postId}`);
  await author.waitForLoadState("networkidle");
  const hello = `Привет из E2E ${Date.now().toString(36)}`;
  await send(guest, hello);
  await expect(author.getByText(hello)).toBeVisible({ timeout: 15_000 });

  const reply = `Ответ автора ${Date.now().toString(36)}`;
  await send(author, reply);
  await expect(guest.getByText(reply)).toBeVisible({ timeout: 15_000 });

  // Уведомление о новом участнике дошло — триггер читает user_settings (0040).
  await author.goto("/notifications");
  await expect(author.getByText(nicknameOf(guestPerson)).first()).toBeVisible();

  // Права: чужую идею правкой не открыть.
  const edit = await guest.goto(`/post/${postId}/edit`);
  expect(edit?.status()).toBe(404);

  await author.context().close();
  await guest.context().close();
});

async function findPeople(page: Page, query: string): Promise<void> {
  await page.goto("/search?tab=people");
  // Людей ищет server action по мере ввода — ждём его ответ, а не таймер.
  const answered = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/search",
  );
  await page.locator("#search-query").fill(query);
  await answered;
}

test("интересы только для друзей: незнакомец не видит их ни на экране, ни в ответе, ни в поиске", async ({
  browser,
}) => {
  const [ownerPerson, strangerPerson] = await Promise.all([
    createConfirmedPerson("owner"),
    createConfirmedPerson("stranger"),
  ]);
  const owner = await personIn(browser, ownerPerson);
  const stranger = await personIn(browser, strangerPerson);
  const ownerNick = nicknameOf(ownerPerson);
  const interest = `Скалолазание${Date.now().toString(36).slice(-4)}`;

  await owner.goto("/settings/profile");
  await owner.getByLabel("Интересы").fill(interest);
  await owner.getByLabel("Интересы").press("Enter");
  await owner.getByRole("button", { name: "Сохранить" }).click();
  await expect(owner.getByText("Сохранено. Так тебя теперь видят другие.")).toBeVisible();

  // Пока интересы открыты всем — незнакомец находит по ним.
  await findPeople(stranger, interest);
  await expect(stranger.getByRole("link", { name: new RegExp(ownerNick) }).first()).toBeVisible();

  await owner.goto("/settings/privacy");
  const interestsAudience = owner.getByRole("radiogroup", { name: "Кто видит интересы и цели" });
  await interestsAudience.getByText("Только друзья", { exact: true }).click();
  await expect(interestsAudience.getByRole("radio", { name: /Только друзья/ })).toBeChecked();
  await owner.getByRole("button", { name: "Сохранить" }).click();
  await expect(owner.getByText("Сохранено.", { exact: true })).toBeVisible();

  // Свой профиль владелец видит целиком…
  await owner.goto(`/u/${ownerNick}`);
  await expect(owner.getByText(interest)).toBeVisible();

  // …а незнакомец — без интересов, и в ответе сервера их нет вовсе.
  const response = await stranger.goto(`/u/${ownerNick}`);
  await expect(stranger.getByRole("heading", { name: ownerNick, exact: true }).first()).toBeVisible();
  await expect(stranger.getByText(`${ownerNick} показывает интересы и цели только друзьям.`)).toBeVisible();
  expect(await response?.text()).not.toContain(interest);

  // Поиск по скрытому интересу больше не находит, по нику — находит.
  await findPeople(stranger, interest);
  await expect(stranger.getByText("Никого не нашлось")).toBeVisible();
  await expect(stranger.getByRole("link", { name: new RegExp(ownerNick) })).toHaveCount(0);
  await findPeople(stranger, ownerNick);
  await expect(stranger.getByRole("link", { name: new RegExp(ownerNick) }).first()).toBeVisible();

  await owner.context().close();
  await stranger.context().close();
});
