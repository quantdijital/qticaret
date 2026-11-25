import {
  ContainerRegistrationKeys,
  Modules,
  defineConfig,
  loadEnv,
} from "@medusajs/framework/utils"
import { disabledModules } from "./src/lib/disabled-modules"
import { isLocalEnv, parseEnv } from "./src/lib/env"
import { SESSION_COOKIE } from "./src/lib/session-cookie"

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
    // explicitly local; 8 hours, a working day. Its own name: the shop's
    // panel on the same machine keeps its session (Ek C6)
    cookieOptions: { httpOnly: true, sameSite: "strict", secure: !isLocalEnv(env) },
    sessionOptions: { name: SESSION_COOKIE, ttl: 8 * 60 * 60 * 1000 },
    http: {
      // No storefront: the allowlist answers /store with 404 whatever the
      // origin; Medusa still asks for a value
      storeCors: env.ADMIN_CORS,
      adminCors: env.ADMIN_CORS,
      authCors: env.AUTH_CORS,
      jwtSecret: env.JWT_SECRET,
      // Ek C4 (M1): a token only opens a session; once deployed no
      // /admin/cp route takes one. Medusa's default is a day
      jwtExpiresIn: "15m",
      cookieSecret: env.COOKIE_SECRET,
      // Platform staff only, by e-mail, with mandatory 2FA (C4)
      authMethodsPerActor: { user: ["emailpass"] },
    },
  },
  modules: [
    ...disabledModules(),
    // C4 (adr/0061 §3.5): configuring the module drops Medusa's default
    // provider, so e-mail is named again; staff TOTP sealed with its own key
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [{ resolve: "@medusajs/medusa/auth-emailpass", id: "emailpass" }],
        mfa: { encryption_key: env.AUTH_MFA_ENCRYPTION_KEY },
      },
    },
    // C4: platform staff roles and the append-only audit log, the control plane's own
    { resolve: "./src/modules/cp-staff" },
    { resolve: "./src/modules/cp-audit" },
    // C7 (adr/0061 §2): the shops and their packages
    { resolve: "./src/modules/tenants" },
    { resolve: "./src/modules/plans" },
    // C8 (adr/0061 §2, §4): sealed secrets, escrow and signing keys (the
    // ADR's `secrets`, named `vault`, Ek C8); the shops' public keys
    { resolve: "./src/modules/vault" },
    { resolve: "./src/modules/fleet" },
    // C10 (adr/0061 §6): the setup's runs and steps
    { resolve: "./src/modules/provisioning" },
    // C16 (adr/0061 §7): subscriptions, charges, reminders, the payment instruction
    { resolve: "./src/modules/billing" },
    // adr/0085 §1: the AI platform credits' wallets and ledger
    { resolve: "./src/modules/ai-credits" },
  ],
})
