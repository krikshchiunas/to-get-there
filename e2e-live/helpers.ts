import { randomBytes, randomUUID } from "node:crypto";
import { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Общее для E2E со входом: люди, письма и сессия.
 *
 * Пароли генерируются на каждый прогон и нигде не печатаются; почта — на
 * домене вуза из сида (tu-berlin.de), иначе регистрацию не пропустит
 * триггер 0013. Письма никуда не уходят: локальная Supabase складывает их
 * в Mailpit.
 */

export const API_URL = process.env.API_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY ?? process.env.SECRET_KEY ?? "";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export interface Person {
  email: string;
  password: string;
}

/** Новый адрес и пароль. `tag` попадает в ник — по нему легче читать отчёт. */
export function newPerson(tag: string): Person {
  const stamp = randomUUID().replace(/-/g, "").slice(0, 8);
  return {
    email: `e2e.${tag}.${stamp}@tu-berlin.de`,
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
export async function linkFromMail(email: string, since: number): Promise<string> {
  const query = encodeURIComponent(`to:"${email}"`);
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`)).json()) as {
      messages?: MailSummary[];
    };
    const fresh = (list.messages ?? []).find((message) => Date.parse(message.Created) >= since - 2_000);
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

/** Вход через форму — так же, как входит человек. */
export async function signIn(page: Page, person: Person, next?: string): Promise<void> {
  await page.goto(next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login");
  await page.getByLabel("Почта").fill(person.email);
  await page.getByLabel("Пароль").fill(person.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
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
