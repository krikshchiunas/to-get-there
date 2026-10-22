import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import {
  accessTokenOf,
  alertIn,
  createConfirmedPerson,
  fillLogin,
  linkFromMail,
  mailIds,
  newDevice,
  newPerson,
  requestReset,
  rest,
  setNewPassword,
  signIn,
  signOut,
  sql,
  submitSignUp,
  test,
} from "./helpers";

/**
 * Вход как подсистема безопасности: всё, что должно не пустить, не пустить
 * и не выдать. Настоящий Supabase Auth, настоящие письма, настоящий RLS —
 * без подмены входа.
 */

async function noAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/* ── регистрация и подтверждение ───────────────────────────────────── */

test("регистрация: ошибки видны до запроса, фокус — в поле с ошибкой, экран доступен", async ({ page }) => {
  const person = newPerson("form", "gmail.com");
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });

  await page.goto("/auth/signup");
  await page.getByLabel("Почта", { exact: true }).fill(person.email);
  await page.getByLabel("Пароль", { exact: true }).fill("short");
  await page.getByLabel("Пароль ещё раз", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();

  await expect(alertIn(page)).toHaveText(/не короче 8/);
  await expect(page.getByLabel("Пароль", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await noAxeViolations(page);

  await page.getByLabel("Пароль", { exact: true }).fill(person.password);
  await page.getByLabel("Пароль ещё раз", { exact: true }).fill(`${person.password}!`);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(alertIn(page)).toHaveText("Пароли не совпадают.");
  await expect(page.getByLabel("Пароль ещё раз", { exact: true })).toBeFocused();

  expect(posts, "форма с ошибкой не уходит на сервер").toEqual([]);
  await expect(page).toHaveURL(/\/auth\/signup$/);
});

test("«Показать пароль»: переключатель с клавиатуры, значение не теряется", async ({ page }) => {
  await page.goto("/auth/login");
  const field = page.getByLabel("Пароль", { exact: true });
  const toggle = page.getByRole("button", { name: "Показать пароль" });

  await field.fill("секрет-пароль-1234");
  await expect(field).toHaveAttribute("type", "password");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(field).toHaveAttribute("type", "text");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(field).toHaveValue("секрет-пароль-1234");

  await page.keyboard.press("Enter");
  await expect(field).toHaveAttribute("type", "password");
  // Менеджеры паролей находят поле по autocomplete — он не меняется.
  await expect(field).toHaveAttribute("autocomplete", "current-password");
});

test("письмо подтверждения ещё раз: новое письмо приходит, ссылка из него работает", async ({ page }) => {
  const person = newPerson("resend", "gmail.com");
  const since = await submitSignUp(page, person);
  await expect(page).toHaveURL(/\/auth\/check-email$/);
  await linkFromMail(person.email, since);
  const known = await mailIds(person.email);

  await page.waitForTimeout(1_500); // GoTrue: не чаще раза в секунду (config.toml, max_frequency)
  const again = Date.now();
  await page.getByRole("button", { name: "Отправить ещё раз" }).click();
  await expect(page.getByText("письмо отправлено ещё раз")).toBeVisible();
  await noAxeViolations(page);

  await page.goto(await linkFromMail(person.email, again, known));
  await expect(page).toHaveTitle(/Идеи/);
});

test("ссылка подтверждения второй раз не входит, но подтверждённый аккаунт входит паролем", async ({
  page,
}) => {
  const person = newPerson("reconfirm", "gmail.com");
  const since = await submitSignUp(page, person);
  const link = await linkFromMail(person.email, since);

  await page.goto(link);
  await expect(page).toHaveTitle(/Идеи/);
  await signOut(page);

  await page.goto(link);
  await expect(page).toHaveURL(/\/auth\/login\?error=link$/);
  await expect(page.getByRole("status")).toContainText("недействительна или уже использована");

  await fillLogin(page, person);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveTitle(/Идеи/);
});

test("подтверждение на другом устройстве — по token_hash, без cookie первого браузера", async ({
  page,
  browser,
}) => {
  const person = newPerson("confirm-device", "gmail.com");
  const since = await submitSignUp(page, person);
  const token = new URL(await linkFromMail(person.email, since)).searchParams.get("token");
  expect(token, "token в ссылке письма").toBeTruthy();

  const phone = await newDevice(browser);
  const other = await phone.newPage();
  await other.goto(`/auth/confirm?token_hash=${token}&type=email`);
  await expect(other).toHaveTitle(/Идеи/);
  await phone.close();
});

test("неподтверждённая почта: вход объясняет, что делать, и ведёт к повторному письму", async ({ page }) => {
  const person = newPerson("unconfirmed", "gmail.com");
  await submitSignUp(page, person);
  await expect(page).toHaveURL(/\/auth\/check-email$/);

  await page.goto("/auth/login");
  await fillLogin(page, person);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(alertIn(page)).toContainText("Почта ещё не подтверждена");
  await page.getByRole("link", { name: "Отправить письмо ещё раз" }).click();
  await expect(page).toHaveURL(/\/auth\/check-email$/);
  await expect(page.getByLabel("Почта", { exact: true })).toHaveValue(person.email);
});

/* ── вход, выход, сессия ───────────────────────────────────────────── */

test("чужой `next` не уводит с сайта — после входа человек на главной", async ({ page }) => {
  const person = await createConfirmedPerson("next-evil");
  for (const evil of [
    "https://evil.example/steal",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
  ]) {
    await page.goto(`/auth/login?next=${encodeURIComponent(evil)}`);
    await fillLogin(page, person);
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page, evil).toHaveURL("http://localhost:3000/");
    await signOut(page);
  }
});

test("выход отзывает сессию: обновление и скопированные cookie не пускают", async ({
  page,
  context,
  browser,
}) => {
  const person = await createConfirmedPerson("revoke");
  await signIn(page, person);
  await page.goto("/settings");
  const stolen = await context.cookies();

  await signOut(page);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fsettings/);

  // Cookie, снятые до выхода, — отозванная сессия: Supabase её не признаёт.
  const thief = await newDevice(browser);
  await thief.addCookies(stolen);
  const thiefPage = await thief.newPage();
  await thiefPage.goto("/settings");
  await expect(thiefPage).toHaveURL(/\/auth\/login\?next=%2Fsettings/);
  await thief.close();
});

test("две вкладки: выход в одной — вторая тоже снаружи; вход переживает перезапуск браузера", async ({
  page,
  context,
  browser,
}) => {
  const person = await createConfirmedPerson("tabs");
  await signIn(page, person);

  // Перезапуск браузера: те же cookie в новом контексте — человек внутри.
  const restarted = await newDevice(browser, { storageState: await context.storageState() });
  const again = await restarted.newPage();
  await again.goto("/settings");
  await expect(again.getByRole("button", { name: "Выйти" })).toBeVisible();
  await restarted.close();

  const second = await context.newPage();
  await second.goto("/notifications");
  await expect(second).toHaveURL(/\/notifications$/);

  await signOut(page);
  await second.reload();
  await expect(second).toHaveURL(/\/auth\/login\?next=%2Fnotifications/);
});

test("профиль пропал, а вход остался — приложение восстанавливает профиль, а не гоняет по кругу", async ({
  page,
}) => {
  const person = await createConfirmedPerson("heal");
  sql(`delete from public.users where auth_user_id = (select id from auth.users where email = :'email');`, {
    email: person.email,
  });

  await signIn(page, person);
  await expect(page).toHaveTitle(/Идеи/);
  expect(
    sql(
      `select count(*) from public.users u join auth.users a on a.id = u.auth_user_id where a.email = :'email';`,
      { email: person.email },
    ),
  ).toBe("1");
});

/* ── восстановление пароля ─────────────────────────────────────────── */

test("сброс у вошедшего: новый пароль выкидывает остальные устройства, а этот остаётся внутри", async ({
  page,
  browser,
}) => {
  const person = await createConfirmedPerson("others");
  await signIn(page, person);
  const phone = await newDevice(browser);
  const phonePage = await phone.newPage();
  await signIn(phonePage, person);

  // Вошедшего форма входа уводит на главную — «Забыли пароль?» открывают напрямую.
  await page.goto("/auth/forgot");
  await page.getByLabel("Почта", { exact: true }).fill(person.email);
  const since = Date.now();
  await page.getByRole("button", { name: "Прислать ссылку" }).click();
  await expect(page).toHaveURL(/\/auth\/check-email\?reason=reset$/);
  await page.goto(await linkFromMail(person.email, since));
  await setNewPassword(page, `${person.password}-new`);

  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
  await phonePage.goto("/settings");
  await expect(phonePage).toHaveURL(/\/auth\/login/);
  await phone.close();
});

test("поддельная ссылка и чужой тип ссылки не открывают форму нового пароля", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=not-a-real-token&type=recovery");
  await expect(page).toHaveURL(/\/auth\/forgot\?error=link$/);
  await expect(page.getByRole("status")).toContainText("устарела или уже использована");
  await noAxeViolations(page);

  await page.goto("/auth/callback?code=not-a-real-code&type=recovery");
  await expect(page).toHaveURL(/\/auth\/forgot\?error=link$/);

  // Токен подтверждения регистрации, выданный за токен сброса.
  const person = newPerson("wrong-type", "gmail.com");
  const since = await submitSignUp(page, person);
  const token = new URL(await linkFromMail(person.email, since)).searchParams.get("token");
  await page.goto(`/auth/confirm?token_hash=${token}&type=recovery`);
  await expect(page).toHaveURL(/\/auth\/forgot\?error=link$/);
  await page.goto("/auth/reset");
  await expect(page.getByRole("heading", { name: "Ссылка устарела" })).toBeVisible();
});

test("старая ссылка сброса умирает, когда пришла новая; новая работает", async ({ page }) => {
  const person = await createConfirmedPerson("older");
  const first = await requestReset(page, person);
  const older = await linkFromMail(person.email, first);
  const known = await mailIds(person.email);

  await page.waitForTimeout(1_500); // GoTrue: не чаще раза в секунду (config.toml, max_frequency)
  const second = await requestReset(page, person);
  const newer = await linkFromMail(person.email, second, known);

  await page.goto(older);
  await expect(page).toHaveURL(/\/auth\/forgot\?error=link$/);
  await page.goto(newer);
  await setNewPassword(page, `${person.password}-newer`);
});

test("ссылка сброса старше часа не работает", async ({ page }) => {
  const person = await createConfirmedPerson("expired-link");
  const since = await requestReset(page, person);
  const link = await linkFromMail(person.email, since);

  sql(`update auth.users set recovery_sent_at = now() - interval '2 hours' where email = :'email';`, {
    email: person.email,
  });
  await page.goto(link);
  await expect(page).toHaveURL(/\/auth\/forgot\?error=link$/);
  // Пароль не сменился и сессии по ссылке нет — входит прежний пароль.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/auth\/login/);
  await signIn(page, person);
});

/* ── лимиты попыток ────────────────────────────────────────────────── */

test("лимит писем сброса: шестое за час — «слишком много попыток», для любой почты одинаково", async ({
  page,
}) => {
  const email = `e2e.nobody.limit.${Date.now()}@gmail.com`;
  for (let i = 1; i <= 5; i += 1) {
    await page.goto("/auth/forgot");
    await page.getByLabel("Почта", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Прислать ссылку" }).click();
    await expect(page, `запрос ${i}`).toHaveURL(/\/auth\/check-email\?reason=reset$/);
  }
  await page.goto("/auth/forgot");
  await page.getByLabel("Почта", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Прислать ссылку" }).click();
  await expect(alertIn(page)).toContainText("Слишком много попыток");
  await expect(page).toHaveURL(/\/auth\/forgot$/);
});

test("лимит входа: после десяти неверных паролей не входит даже верный — до конца окна", async ({ page }) => {
  const person = await createConfirmedPerson("bruteforce");
  await page.goto("/auth/login");
  // Каждая попытка — до ответа сервера: иначе следующая уйдёт, пока кнопка ещё выключена.
  const submit = () =>
    Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST"),
      page.getByRole("button", { name: "Войти" }).click(),
    ]);
  for (let i = 1; i <= 10; i += 1) {
    await fillLogin(page, { ...person, password: `wrong-${i}-password` });
    await submit();
    await expect(alertIn(page), `попытка ${i}`).toHaveText("Неверная почта или пароль.");
  }
  await fillLogin(page, person);
  await submit();
  await expect(alertIn(page)).toContainText("Слишком много попыток");
  await expect(page).toHaveURL(/\/auth\/login/);
});

/* ── чужие данные через API — с настоящим токеном пользователя ─────── */

test("IDOR: с токеном одного человека не прочитать и не изменить данные другого", async () => {
  const [alice, bob] = await Promise.all([createConfirmedPerson("idor-a"), createConfirmedPerson("idor-b")]);
  const a = await accessTokenOf(alice);
  const b = await accessTokenOf(bob);
  const profileOf = async (token: string, authId: string) =>
    ((await rest(`users?select=id&auth_user_id=eq.${authId}`, { token })).body as Array<{ id: string }>)[0]
      .id;
  const aliceId = await profileOf(a.token, a.authId);
  const bobId = await profileOf(b.token, b.authId);

  const idea = {
    category_id: "22222222-2222-2222-2222-000000000001",
    title: "Идея Боба",
    description: "",
    date_start: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    geo_mode: "city",
    geo_city: "Берлин",
  };
  const created = await rest("posts?select=id", {
    method: "POST",
    token: b.token,
    prefer: "return=representation",
    body: { ...idea, author_id: bobId },
  });
  expect(created.status).toBe(201);
  const postId = (created.body as Array<{ id: string }>)[0].id;

  // Чужую идею не изменить (RLS — ноль строк) и не создать от чужого имени.
  const patched = await rest(`posts?id=eq.${postId}`, {
    method: "PATCH",
    token: a.token,
    prefer: "return=representation",
    body: { title: "Взлом" },
  });
  expect(patched.body).toEqual([]);
  const forged = await rest("posts", { method: "POST", token: a.token, body: { ...idea, author_id: bobId } });
  expect((forged.body as { code: string }).code).toBe("42501");

  // Себя модератором чужой идеи не назначить, отметку «подтверждён» не поставить.
  const moderator = await rest("post_moderators", {
    method: "POST",
    token: a.token,
    body: {
      post_id: postId,
      user_id: aliceId,
      permissions: { can_post_media: true, can_pin: true, can_poll: true, can_kick: true },
    },
  });
  expect((moderator.body as { code: string }).code).toBe("42501");
  const verified = await rest(`users?id=eq.${aliceId}`, {
    method: "PATCH",
    token: a.token,
    body: { is_verified: true },
  });
  expect((verified.body as { code: string }).code).toBe("42501");

  // Профиль не удалить мимо удаления аккаунта (0043).
  const deleted = await rest(`users?id=eq.${aliceId}`, { method: "DELETE", token: a.token });
  expect((deleted.body as { code: string }).code).toBe("42501");

  // Чужие настройки уведомлений и скрытые интересы не прочитать.
  expect((await rest(`user_settings?user_id=eq.${bobId}`, { token: a.token })).body).toEqual([]);
  await rest(`user_tags?user_id=eq.${bobId}`, {
    method: "PATCH",
    token: b.token,
    body: { interests: ["Тайное"] },
  });
  await rest(`users?id=eq.${bobId}`, {
    method: "PATCH",
    token: b.token,
    body: {
      privacy_settings: {
        who_can_message: "everyone",
        who_can_see_profile: "everyone",
        who_can_see_interests: "friends",
        visible_in_search: true,
        read_receipts: true,
      },
    },
  });
  expect((await rest(`user_tags?user_id=eq.${bobId}`, { token: a.token })).body).toEqual([]);
  expect((await rest(`user_tags?user_id=eq.${bobId}`, { token: b.token })).body).toHaveLength(1);

  // Без входа — ничего личного.
  const anonymous = await rest("users?select=id");
  expect(anonymous.status).toBe(401);
});
