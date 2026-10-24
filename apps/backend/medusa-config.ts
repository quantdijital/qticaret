import { defineConfig, loadEnv } from "@medusajs/framework/utils"
import { parseEnv } from "./src/lib/env"

loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd())

const env = parseEnv()
const isDeployed = env.NODE_ENV === "production" || env.NODE_ENV === "staging"

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: env.DATABASE_URL,
    // Session store for cookie auth (adr/0004); without it sessions live in
    // process memory, so the env schema requires it when deployed.
    ...(env.REDIS_URL ? { redisUrl: env.REDIS_URL } : {}),
    // Customer web sessions: never readable by scripts, sent on top-level
    // navigation only, HTTPS-only when deployed (adr/0004; CSRF in F2.10).
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: isDeployed },
    http: {
      storeCors: env.STORE_CORS,
      adminCors: env.ADMIN_CORS,
      authCors: env.AUTH_CORS,
      jwtSecret: env.JWT_SECRET,
      cookieSecret: env.COOKIE_SECRET,
    },
  },
  modules: [
    { resolve: "./src/modules/tr-address" },
    {
      resolve: "./src/modules/billing-profile",
      options: { encryptionKey: env.PII_ENCRYPTION_KEY, hashKey: env.PII_HASH_KEY },
    },
  ],
})
