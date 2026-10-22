import { execFileSync } from "node:child_process";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

/**
 * Общее для E2E со входом: люди, письма и сессия.
 *
 * Пароли генерируются на каждый прогон и нигде не печатаются. Почта — на
 * домене вуза из сида (tu-berlin.de), чтобы профиль получил вуз; любая
 * другая тоже годится — регистрация открыта (0043). Письма никуда не
 * уходят: локальная Supabase складывает их в Mailpit.
 */

export const API_URL = process.env.API_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY ?? process.env.SECRET_KEY ?? "";
const ANON_KEY = process.env.ANON_KEY ?? process.env.PUBLISHABLE_KEY ?? "";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Свой «адрес клиента» на каждый тест: лимиты попыток считают и по адресу
 * (0043), и тесты не должны делить один бакет. Приложение берёт адрес из
 * x-real-ip, когда нет заголовка Vercel (lib/auth/request.ts).
 */
export function fakeAddress(): string {
  return `198.51.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-real-ip": fakeAddress() });
  },
});

/** Второй браузер («другое устройство») — со своим адресом. */
export function newDevice(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}) {
  return browser.newContext({
    locale: "ru-RU",
    timezoneId: "Europe/Berlin",
    ...options,
    extraHTTPHeaders: { "x-real-ip": fakeAddress(), ...options.extraHTTPHeaders },
  });
}

export interface Person {
  email: string;
  password: string;
}

/** Ссылки из всех писем на адрес, новые первыми (Mailpit). */
export async function mailIds(email: string): Promise<string[]> {
  const query = encodeURIComponent(`to:"${email}"`);
  const list = (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`)).json()) as {
    messages?: Array<{ ID: string }>;
  };
  return (list.messages ?? []).map((message) => message.ID);
}

/** Новый адрес и пароль. `tag` попадает в ник — по нему легче читать отчёт. */
export function newPerson(tag: string, domain = "tu-berlin.de"): Person {
  const stamp = randomUUID().replace(/-/g, "").slice(0, 8);
  return {
    email: `e2e.${tag}.${stamp}@${domain}`,
    password: `${randomBytes(12).toString("base64url")}-Aa1`,
  };
}

/** Ник, который мост 0013 выводит из адреса: локальная часть, не длиннее 19. */
export function nicknameOf(person: Person): string {
  return person.email.split("@")[0].slice(0, 19);
}

function adminHeaders(): Record<string, string> {
  if (!SERVICE_KEY) throw new Error('Нет SERVICE_ROLE_KEY: запусти eval "$(supabase status -o env)"');
  const headers: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json" };
  // Старый ключ — JWT и идёт ещё и в Authorization; новый sb_secret_… шлюз понимает по apikey.
  if (!SERVICE_KEY.startsWith("sb_")) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}

/** Аккаунт с подтверждённой почтой — для тестов, где регистрация не предмет проверки. */
export async function createConfirmedPerson(tag: string): Promise<Person> {
  const person = newPerson(tag);
  const response = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ email: person.email, password: person.password, email_confirm: true }),
  });
  if (!response.ok) {
    throw new Error(`Не удалось создать тестовый аккаунт: ${response.status} ${await response.text()}`);
  }
  return person;
}

interface MailSummary {
  ID: string;
  Created: string;
  Subject: string;
}

/**
 * Ссылка из последнего письма на адрес, пришедшего после `since`.
 * Ждёт до 20 секунд: GoTrue отправляет письмо не мгновенно.
 */
export async function linkFromMail(email: string, since: number, known: string[] = []): Promise<string> {
  const query = encodeURIComponent(`to:"${email}"`);
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`)).json()) as {
      messages?: MailSummary[];
    };
    // `known` — письма, уже бывшие до действия: следующее письмо — не они.
    const fresh = (list.messages ?? []).find(
      (message) => !known.includes(message.ID) && Date.parse(message.Created) >= since - 2_000,
    );
    if (fresh) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${fresh.ID}`)).json()) as {
        HTML?: string;
        Text?: string;
      };
      const body = message.HTML ?? message.Text ?? "";
      const href =
        body.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1] ??
        body.match(/https?:\/\/\S*\/auth\/v1\/verify\S*/)?.[0];
      if (!href) throw new Error(`В письме для ${email} нет ссылки подтверждения`);
      return href.replace(/&amp;/g, "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Письмо для ${email} не пришло за 20 секунд`);
}

/** Сообщение об ошибке формы — не считая пустого объявления переходов Next.js. */
export function alertIn(page: Page): Locator {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

/** Поля формы входа — по точным подписям: у кнопки «Показать пароль» тоже есть слово «пароль». */
export async function fillLogin(page: Page, person: Person): Promise<void> {
  await page.getByLabel("Почта", { exact: true }).fill(person.email);
  await page.getByLabel("Пароль", { exact: true }).fill(person.password);
}

/** Вход через форму — так же, как входит человек. */
export async function signIn(page: Page, person: Person, next?: string): Promise<void> {
  await page.goto(next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login");
  await fillLogin(page, person);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

/** Регистрация через форму; повтор пароля — тот же, если не задан. */
export async function submitSignUp(page: Page, person: Person, repeat = person.password): Promise<number> {
  await page.goto("/auth/signup");
  await page.getByLabel("Почта", { exact: true }).fill(person.email);
  await page.getByLabel("Пароль", { exact: true }).fill(person.password);
  await page.getByLabel("Пароль ещё раз", { exact: true }).fill(repeat);
  const since = Date.now();
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  return since;
}

/** Токен доступа пользователя — тот же, что у приложения, без браузера. */
export async function accessTokenOf(person: Person): Promise<{ token: string; authId: string }> {
  const response = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: person.email, password: person.password }),
  });
  if (!response.ok) throw new Error(`Вход для токена не удался: ${response.status}`);
  const body = (await response.json()) as { access_token: string; user: { id: string } };
  return { token: body.access_token, authId: body.user.id };
}

/** Запрос к PostgREST от имени пользователя (token) или анонима (без него). */
export async function rest(
  path: string,
  init: { method?: string; token?: string; body?: unknown; prefer?: string } = {},
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { apikey: ANON_KEY, "Content-Type": "application/json" };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.prefer) headers.Prefer = init.prefer;
  const response = await fetch(`${API_URL}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

/**
 * SQL в локальной базе — только чтобы создать состояние, до которого
 * интерфейсом не дойти (ссылка, которой два часа; пропавший профиль).
 * Значения — через переменные psql, а не склейкой строки.
 */
export function sql(statement: string, variables: Record<string, string> = {}): string {
  const args = [DB_URL, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"];
  for (const [name, value] of Object.entries(variables)) args.push("-v", `${name}=${value}`);
  return execFileSync("psql", args, { input: statement, encoding: "utf8" }).trim();
}

/** Выход через «Настройки» — кнопка, которой пользуется человек. */
export async function signOut(page: Page): Promise<void> {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
}

const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Сессия, которую уже не продлить: срок вышел, refresh-токен отозван.
 * Так выглядит браузер, вернувшийся через неделю после выхода с другого
 * устройства.
 */
export async function expireSession(context: BrowserContext): Promise<void> {
  const cookies = (await context.cookies()).filter((cookie) => AUTH_COOKIE.test(cookie.name));
  expect(cookies.length, "cookie сессии Supabase").toBeGreaterThan(0);

  const ordered = [...cookies].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const raw = ordered.map((cookie) => cookie.value).join("");
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString("utf8") : raw;
  const session = JSON.parse(json) as Record<string, unknown>;

  session.expires_at = Math.floor(Date.now() / 1000) - 3600;
  session.refresh_token = "revoked-by-e2e";

  const base = ordered[0];
  const name = base.name.replace(/\.\d+$/, "");
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  // Как @supabase/ssr: длинное значение — частями name.0, name.1…, иначе
  // браузер отбросит cookie длиннее 4 КБ.
  const CHUNK = 3180;
  const parts =
    value.length <= CHUNK
      ? [{ name, value }]
      : Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, index) => ({
          name: `${name}.${index}`,
          value: value.slice(index * CHUNK, (index + 1) * CHUNK),
        }));

  await context.clearCookies({ name: AUTH_COOKIE });
  await context.addCookies(
    parts.map((part) => ({
      ...part,
      domain: base.domain,
      path: base.path,
      httpOnly: base.httpOnly,
      secure: base.secure,
      sameSite: base.sameSite,
      expires: base.expires,
    })),
  );
}

/** «Забыли пароль?» со страницы входа; возвращает время до отправки — для поиска письма. */
export async function requestReset(page: Page, person: Person): Promise<number> {
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Забыли пароль?" }).click();
  await expect(page).toHaveURL(/\/auth\/forgot$/);
  await page.getByLabel("Почта", { exact: true }).fill(person.email);
  const since = Date.now();
  await page.getByRole("button", { name: "Прислать ссылку" }).click();
  await expect(page).toHaveURL(/\/auth\/check-email\?reason=reset/);
  return since;
}

/** Форма нового пароля после ссылки из письма — до страницы «Пароль обновлён». */
export async function setNewPassword(page: Page, password: string): Promise<void> {
  await expect(page).toHaveURL(/\/auth\/reset$/);
  await expect(page.getByRole("heading", { name: "Новый пароль" })).toBeVisible();
  await page.getByLabel("Новый пароль").fill(password);
  await page.getByLabel("Ещё раз").fill(password);
  await page.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(page).toHaveURL(/\/auth\/reset\/done$/);
  await expect(page.getByRole("heading", { name: "Пароль обновлён" })).toBeVisible();
}

/** Вход с этим паролем не проходит — «Неверная почта или пароль». */
export async function loginFails(page: Page, person: Person): Promise<void> {
  await page.goto("/auth/login");
  await fillLogin(page, person);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(alertIn(page)).toHaveText("Неверная почта или пароль.");
}
