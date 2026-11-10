import { defineConfig, loadEnv } from "@medusajs/framework/utils"
import { disabledModules } from "./src/lib/disabled-modules"
import { isLocalEnv, parseEnv } from "./src/lib/env"

loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd())

// Fails fast, naming every missing or malformed variable (docs/04)
const env = parseEnv()

module.exports = defineConfig({
  // adr/0061 §1.1: no Medusa Admin; the control plane has its own panel
  admin: { disable: true },
  projectConfig: {
    databaseUrl: env.DATABASE_URL,
    // Sessions shared by processes and kept across restarts; the env
    // schema requires it outside development and test
    ...(env.REDIS_URL ? { redisUrl: env.REDIS_URL } : {}),
    // Staff sessions: never readable by scripts, never sent from another
    // site (the panel is same-origin, adr/0061 §1.3), HTTPS-only unless
    // explicitly local; 8 hours, a working day
    cookieOptions: { httpOnly: true, sameSite: "strict", secure: !isLocalEnv(env) },
    sessionOptions: { ttl: 8 * 60 * 60 * 1000 },
    http: {
      // No storefront: the allowlist answers /store with 404 whatever the
      // origin; Medusa still asks for a value
      storeCors: env.ADMIN_CORS,
      adminCors: env.ADMIN_CORS,
      authCors: env.AUTH_CORS,
      jwtSecret: env.JWT_SECRET,
      cookieSecret: env.COOKIE_SECRET,
      // Platform staff only, by e-mail (2FA arrives with C4)
      authMethodsPerActor: { user: ["emailpass"] },
    },
  },
  modules: disabledModules(),
})
