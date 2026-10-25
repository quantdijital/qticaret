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
const BACKEND_PATHS = ["/admin", "/auth", "/store", "/static", "/health"]

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    proxy: Object.fromEntries(
      BACKEND_PATHS.map((path) => [path, { target: BACKEND_URL, headers: { origin: BACKEND_URL } }])
    ),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}"],
    css: false,
  },
})
