import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", ".next-e2e/**", "playwright-report/**", "test-results/**", "node_modules/**", "supabase/**", "next-env.d.ts"],
  },
];

export default config;
