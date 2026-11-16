import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Q03's archived node:test suites run separately under their offline guard.
  // They require external run manifests and are not Vitest application suites.
  test: { include: ["tests/**/*.test.{ts,tsx}"] },
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
