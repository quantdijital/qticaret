import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

/**
 * The control plane's panel is served from the control plane's own host
 * once deployed (adr/0061 §1.3): no CORS, a cookie session, the Origin
 * check. Here Vite's proxy makes it one origin: the browser talks to
 * :5174 only, and its `Origin` (this panel's) goes through unchanged, as
 * the control plane's ADMIN_CORS/AUTH_CORS name it (apps/control-plane
 * env.example). Only the paths the control plane answers (its allowlist,
 * src/lib/route-allowlist.ts) are proxied.
 */
const CONTROL_PLANE_URL = process.env["CP_PANEL_BACKEND_URL"] ?? "http://localhost:9100"
const API_PATHS = ["/auth", "/admin/cp", "/health"]
// Whole path segments only (a key starting with `^` is a pattern to Vite)
const segment = (path: string) => `^${path}(?:[/?]|$)`

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    proxy: Object.fromEntries(
      API_PATHS.map((path) => [segment(path), { target: CONTROL_PLANE_URL }])
    ),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}"],
    css: false,
  },
})
