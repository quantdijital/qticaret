import { defineConfig, loadEnv } from "@medusajs/framework/utils"
import { isLocalEnv, parseEnv } from "./src/lib/env"
import { DEFAULT_LOG_LEVEL, MedusaPinoLogger, baseLogger } from "./src/lib/logging"

loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd())

const env = parseEnv()

module.exports = defineConfig({
  // Core, modules and scripts log through the platform logger: JSON,
  // redacted, with the request ID (docs/10)
  logger: new MedusaPinoLogger(baseLogger, env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL),
  projectConfig: {
    databaseUrl: env.DATABASE_URL,
    // Session store for cookie auth (adr/0004); without it sessions live in
    // process memory, so the env schema requires it when deployed.
    ...(env.REDIS_URL ? { redisUrl: env.REDIS_URL } : {}),
    // Customer web sessions: never readable by scripts, sent on top-level
    // navigation only, HTTPS-only unless explicitly local (adr/0004; CSRF in
    // F2.10). Session lifetime is Medusa's default, stated explicitly: 10
    // hours, shorter than the 1-day bearer token.
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: !isLocalEnv(env) },
    sessionOptions: { ttl: 10 * 60 * 60 * 1000 },
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
    { resolve: "./src/modules/url-registry" },
    { resolve: "./src/modules/audit-log" },
    {
      resolve: "./src/modules/billing-profile",
      options: { encryptionKey: env.PII_ENCRYPTION_KEY, hashKey: env.PII_HASH_KEY },
    },
  ],
})
