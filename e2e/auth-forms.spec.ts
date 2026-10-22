import { expect, test } from "./fixtures";

/**
 * Формы входа без базы: клавиатура, фокус, ошибки у полей, менеджеры
 * паролей и адреса. Сам вход, письма и сессии — в e2e-live на настоящей
 * Supabase; здесь — то, что форма делает до отправки и чего не должна
 * отправлять вовсе.
 */

test("вход: пустая форма не уходит, фокус — на первое поле с ошибкой", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "Войти" }).click();

  const email = page.getByLabel("Почта");
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "email-error");
  await expect(page.locator("#email-error")).toHaveText(/Введи почту/);
  await expect(page.locator("#password-error")).toHaveText(/Введи пароль/);
  await expect(page).toHaveURL(/\/auth\/login$/);

  // Начал править — ошибка у поля уходит, а не кричит на каждой букве.
  await email.fill("a");
  await expect(page.locator("#email-error")).toHaveCount(0);
});

test("вход с клавиатуры: порядок Tab и Enter", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("Почта").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Пароль", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Показать пароль" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Забыли пароль?" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Войти" })).toBeFocused();

  // Enter в поле отправляет форму — и неверная почта ловится до сервера.
  await page.getByLabel("Почта").fill("not-an-address");
  await page.getByLabel("Пароль", { exact: true }).fill("whatever");
  await page.getByLabel("Пароль", { exact: true }).press("Enter");
  await expect(page.getByLabel("Почта")).toBeFocused();
  await expect(page.locator("#email-error")).toHaveText(/целиком/);
});

test("«Показать пароль» — переключатель, который понимают читалки и менеджеры паролей", async ({ page }) => {
  await page.goto("/auth/login");
  const password = page.getByLabel("Пароль", { exact: true });
  const toggle = page.getByRole("button", { name: "Показать пароль" });

  await password.fill("секретная фраза");
  await expect(password).toHaveAttribute("type", "password");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(password).toHaveAttribute("type", "text");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(password).toHaveValue("секретная фраза");

  await toggle.click();
  await expect(password).toHaveAttribute("type", "password");
});

test("автозаполнение: правильные autocomplete на всех формах", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.getByLabel("Почта")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password",
  );

  await page.goto("/auth/signup");
  await expect(page.getByLabel("Почта")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByLabel("Пароль ещё раз")).toHaveAttribute("autocomplete", "new-password");

  await page.goto("/settings/security");
  await expect(page.getByLabel("Текущий пароль")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByLabel("Новый пароль", { exact: true })).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  // Скрытое поле с почтой — чтобы менеджер паролей обновил нужную запись.
  await expect(page.locator('input[autocomplete="username"]')).toHaveValue("mara.t@tu-berlin.de");
});

test("регистрация: ошибки у полей при уходе с них и при отправке", async ({ page }) => {
  await page.goto("/auth/signup");

  await page.getByLabel("Почта").fill("student@uni");
  await page.getByLabel("Пароль", { exact: true }).focus();
  await expect(page.locator("#email-error")).toHaveText(/целиком/);

  await page.getByLabel("Почта").fill("student@gmail.com");
  await page.getByLabel("Пароль", { exact: true }).fill("short");
  await page.getByLabel("Пароль ещё раз").focus();
  await expect(page.locator("#password-error")).toHaveText(/не короче 8/);

  await page.getByLabel("Пароль", { exact: true }).fill("long enough phrase");
  await page.getByLabel("Пароль ещё раз").fill("long enough phrase!");
  await page.getByRole("checkbox", { name: /Мне есть 16/ }).focus();
  await expect(page.locator("#repeat-error")).toHaveText("Пароли не совпадают.");

  // Всё верно, кроме согласия: форма не уходит, фокус — на флажок.
  await page.getByLabel("Пароль ещё раз").fill("long enough phrase");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  const terms = page.getByRole("checkbox", { name: /Мне есть 16/ });
  await expect(terms).toBeFocused();
  await expect(terms).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#terms-error")).toHaveText(/подтверди возраст/);
  await expect(page).toHaveURL(/\/auth\/signup$/);
});

test("привычные адреса ведут на экраны входа и сохраняют ?next", async ({ page }) => {
  await page.goto("/login?next=%2Fmessages");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fmessages$/);
  await expect(page.locator('input[name="next"]')).toHaveValue("/messages");

  for (const [alias, target] of [
    ["/register", /\/auth\/signup$/],
    ["/signup", /\/auth\/signup$/],
    ["/forgot-password", /\/auth\/forgot$/],
    ["/reset-password", /\/auth\/reset$/],
  ] as const) {
    await page.goto(alias);
    await expect(page).toHaveURL(target);
  }
});

test("открытый редирект: чужой адрес в ?next не доходит даже до формы", async ({ page }) => {
  for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "/auth/login"]) {
    await page.goto(`/auth/login?next=${encodeURIComponent(evil)}`);
    await expect(page.locator('input[name="next"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Зарегистрироваться" })).toHaveAttribute(
      "href",
      "/auth/signup",
    );
  }
});

test("«Вход и безопасность»: почта аккаунта, смена пароля, выход везде", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /Вход и безопасность/ }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(page.getByRole("heading", { name: "Вход и безопасность" })).toBeVisible();
  await expect(page.getByText("mara.t@tu-berlin.de")).toBeVisible();
  await expect(page.getByRole("button", { name: "Выйти на всех устройствах" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Не помню текущий пароль" })).toHaveAttribute(
    "href",
    "/auth/forgot",
  );
});
