import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", ".next-e2e", "e2e"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      // Юнит-тесты отвечают за чистую логику: правила доступа, форматирование,
      // разбор строк базы, проверку ввода, CSP, подписи Stripe.
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/**/*.test.ts",
        "lib/mock/**", // демо-данные, не логика
        "lib/database.types.ts", // сгенерировано
        "lib/types.ts", // типы и одна однострочная функция
        // Ходят в Supabase или в браузерные API — их проверяют E2E (e2e/)
        // и тесты базы (supabase/tests), а не моки поверх моков.
        "lib/data/!(map).ts",
        "lib/supabase/**",
        "lib/live.ts",
        "lib/use-*.ts",
        "lib/upload.ts",
        "lib/site-url.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
