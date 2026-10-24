import { defineConfig, loadEnv } from "@medusajs/framework/utils"
import { requireEnv } from "./src/lib/env"

loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: requireEnv("DATABASE_URL"),
    http: {
      storeCors: requireEnv("STORE_CORS"),
      adminCors: requireEnv("ADMIN_CORS"),
      authCors: requireEnv("AUTH_CORS"),
      jwtSecret: requireEnv("JWT_SECRET"),
      cookieSecret: requireEnv("COOKIE_SECRET"),
    },
  },
})
