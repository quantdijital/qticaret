import { defineConfig } from "vitest/config"

// The panel's test setup (jsdom, Testing Library), with the package's own words registered
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}"],
    css: false,
  },
})
