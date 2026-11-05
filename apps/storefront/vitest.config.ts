import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // adr/0057: the build's theme; unit tests run the base theme's entry
      "@qticaret/storefront-theme-error": fileURLToPath(
        new URL("./src/themes/base-error.ts", import.meta.url)
      ),
      "@qticaret/storefront-theme": fileURLToPath(new URL("./src/themes/base.ts", import.meta.url)),
      // `server-only` throws outside a React Server environment; unit tests
      // exercise the same modules in plain Node
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.{ts,tsx}"],
  },
})
