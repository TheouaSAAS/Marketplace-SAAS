import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` lève une erreur hors du runtime serveur de Next.js ; neutralisé en test.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "supabase/**/*.test.ts", "tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Règles métier et composants : là où vit la logique testable unitairement (les pages et
      // actions serveur sont couvertes par les tests de bout en bout et les tests SQL).
      include: ["src/**/domain/**", "src/lib/**", "src/domain/**", "src/config/**", "src/components/**", "src/modules/**/components/**"],
      exclude: ["**/*.test.{ts,tsx}"],
      reporter: ["text-summary", "json-summary"],
    },
    env: {
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_DEFAULT_CITY_SLUG: "san-pedro",
    },
  },
});
