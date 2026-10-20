import { defineConfig, devices } from "@playwright/test";

/**
 * E2E со входом — на настоящей локальной Supabase, без моков.
 *
 * Регистрация с письмом подтверждения (Mailpit), вход и выход, истёкшая
 * сессия, сброс пароля, права и запись, realtime между двумя людьми. В CI —
 * job `e2e-live` после `supabase start`; локально нужен Docker:
 *
 *   supabase start
 *   eval "$(supabase status -o env)"   # API_URL, ANON_KEY, SERVICE_ROLE_KEY
 *   npm run test:e2e:live
 *
 * Тесты идут по очереди: у них общая база, а почта и лимиты считаются на
 * аккаунт. Каждый тест заводит своих людей, поэтому порядок не важен.
 */
const PORT = 3000;
const API_URL = process.env.API_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.ANON_KEY ?? process.env.PUBLISHABLE_KEY ?? "";

export default defineConfig({
  testDir: "./e2e-live",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-live" }]]
    : "list",
  use: {
    // Тот же адрес, что site_url в supabase/config.toml: на него GoTrue
    // ведёт ссылки из писем.
    baseURL: `http://localhost:${PORT}`,
    locale: "ru-RU",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_USE_MOCKS: "false",
      NEXT_PUBLIC_SUPABASE_URL: API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      NEXT_DIST_DIR: ".next-live",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
