import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

/**
 * The panel is served from the backend's own host (adr/0022 §4): in
 * production by the reverse proxy (F16), here by Vite's proxy. The browser
 * sees one origin, so the session cookie and the Origin-based CSRF check
 * work as they do for Medusa's admin. The proxy sets `Origin` to the
 * backend's, which is what the browser would send in production.
 */
const BACKEND_URL = process.env["PANEL_BACKEND_URL"] ?? "http://localhost:9000"
// 5173; a shop the control plane's local provisioner set up opens its own panel on
// its port + 1000 (adr/0061 Ek C10): `PANEL_PORT=10200 PANEL_BACKEND_URL=http://localhost:9200`
const PORT = Number(process.env["PANEL_PORT"] ?? 5173)
const BACKEND_PATHS = ["/admin", "/auth", "/store", "/static", "/health"]
// Whole path segments only: the panel's own `/storefront/menus` is no `/store` call
// (a key starting with `^` is a pattern to Vite; a plain one matches any prefix)
const segment = (path: string) => `^${path}(?:[/?]|$)`

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: PORT,
    proxy: Object.fromEntries(
      BACKEND_PATHS.map((path) => [
        segment(path),
        { target: BACKEND_URL, headers: { origin: BACKEND_URL } },
      ])
    ),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}"],
    css: false,
    // A CI runner types into a form several times slower than a desk machine
    // does: the same tests, more room (the default 5 s stays everywhere else)
    testTimeout: process.env["CI"] ? 15_000 : 5_000,
  },
})
