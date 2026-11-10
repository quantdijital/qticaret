import { z } from "@medusajs/framework/zod"
import {
  EnvValidationError,
  isLocalEnv,
  key256,
  nodeEnv,
  originList,
  parseEnvWith,
  secret,
} from "@qticaret/server-kit"

/**
 * The control plane's environment (adr/0061), validated once at startup: a
 * missing or malformed variable stops the process with a message naming
 * every problem by variable name, never by value (docs/04). Later tasks add
 * their keys here (signing key, master key, provisioner).
 */

export { EnvValidationError, isLocalEnv }

const envSchema = z.object({
  // No default: an unset NODE_ENV must not quietly mean "development"
  NODE_ENV: nodeEnv,
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: "must be a postgres:// URL" }),
  // Sessions and rate limit counters shared by processes; required once deployed
  REDIS_URL: z.url({ protocol: /^rediss?$/, error: "must be a redis:// URL" }).optional(),
  // The control plane's panel (adr/0061 §1.3) is served from the same origin
  // once deployed; locally its dev server's origin
  ADMIN_CORS: originList,
  AUTH_CORS: originList,
  JWT_SECRET: secret,
  COOKIE_SECRET: secret,
  // Keyed hash of identities the control plane counts or looks up without
  // keeping them (a login's e-mail in the rate limiter)
  CP_HASH_KEY: key256,
  // Staff 2FA (adr/0061 §3.5): Medusa's MFA seals each TOTP secret with it.
  // Always required: 2FA is never optional here
  AUTH_MFA_ENCRYPTION_KEY: key256,
  // `off` lets a developer skip 2FA on this machine; refused anywhere else
  ADMIN_MFA: z.enum(["on", "off"]).optional(),
  // The control plane's panel (apps/control-plane-panel): invitation links
  CP_PANEL_URL: z.url({ protocol: /^https?$/, error: "must be an http(s) URL" }),
  // E-mail (adr/0061 Ek C4): Mailpit on a developer's machine; unset, nothing
  // is sent and an invitation's link is handed to whoever made it
  EMAIL_TRANSPORT: z.enum(["mailpit"]).optional(),
  MAILPIT_URL: z.url({ protocol: /^https?$/ }).optional(),
  EMAIL_FROM: z.email().max(254).optional(),
  // F15.3: per-IP limits a thousand times larger for load tests from one
  // machine (perIpScale); development, test and staging only
  LOAD_TEST: z.enum(["on", "off"]).optional(),
})

export type Env = z.infer<typeof envSchema>

const deployedEnvSchema = envSchema.superRefine((env, ctx) => {
  const deployed = !isLocalEnv(env)
  if (deployed && !env.REDIS_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["REDIS_URL"],
      message: "is required outside development and test",
    })
  }
  // A token and a cookie signed with one key: one leak forges both
  if (env.JWT_SECRET === env.COOKIE_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ["COOKIE_SECRET"],
      message: "must differ from JWT_SECRET",
    })
  }
  if (env.ADMIN_MFA === "off" && deployed) {
    ctx.addIssue({
      code: "custom",
      path: ["ADMIN_MFA"],
      message: "off is allowed on development and test only",
    })
  }
  if (env.EMAIL_TRANSPORT === "mailpit" && (deployed || env.MAILPIT_URL === undefined)) {
    ctx.addIssue({
      code: "custom",
      path: ["EMAIL_TRANSPORT"],
      message: "mailpit needs MAILPIT_URL and is not allowed on staging or production",
    })
  }
  if (env.EMAIL_TRANSPORT !== undefined && env.EMAIL_FROM === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["EMAIL_FROM"],
      message: "is required with EMAIL_TRANSPORT",
    })
  }
  if (deployed && !env.CP_PANEL_URL.startsWith("https://")) {
    ctx.addIssue({
      code: "custom",
      path: ["CP_PANEL_URL"],
      message: "must be https outside development and test",
    })
  }
  if (env.LOAD_TEST === "on" && !(isLocalEnv(env) || env.NODE_ENV === "staging")) {
    ctx.addIssue({
      code: "custom",
      path: ["LOAD_TEST"],
      message: "is allowed on development, test and staging only",
    })
  }
})

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  // Blank values count as missing; only schema keys are read
  return parseEnvWith(Object.keys(envSchema.shape), deployedEnvSchema, source)
}
