import { z } from "@medusajs/framework/zod"
import { publicDomainProblem } from "./tenants/hostname"
import {
  EnvValidationError,
  isLocalEnv,
  key256,
  nodeEnv,
  originList,
  parseEnvWith,
  secret,
} from "@qticaret/server-kit"
import { EscrowError, parseAgeRecipients } from "@qticaret/server-kit/escrow"

/**
 * The control plane's environment (adr/0061), validated once at startup: a
 * missing or malformed variable stops the process with a message naming
 * every problem by variable name, never by value (docs/04). Later tasks add
 * their keys here (provisioner). The control plane's signing key is not an
 * env value: it is made and kept sealed in the vault (Ek C8).
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
  // The local key-encryption key(s) of envelope encryption (adr/0061 §4.1):
  // 64 hex characters each, comma-separated, newest first while a rotation
  // runs. First user: a sole proprietor's TCKN (C7)
  CP_MASTER_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}(?:\s*,\s*[0-9a-fA-F]{64})*$/, "must list 64-hex-character keys"),
  // Escrow (adr/0061 §4.3, Ek C8): the offline `age` recipients a shop's
  // runtime secrets are sealed to, the backups' own (infra/backup). Public
  // keys only (`age1…`, comma-separated); the identity that opens them is
  // never on this machine: an age identity here is refused
  CP_ESCROW_RECIPIENTS: z.string().max(40_000),
  // The platform's own domain (adr/0061 §2): a shop's subdomain is
  // `<slug>.<PLATFORM_DOMAIN>`. Not decided yet; `localhost` on this machine
  PLATFORM_DOMAIN: z
    .string()
    .regex(
      /^(?=.{1,200}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/,
      "must be a lower-case host name"
    ),
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
  // One key for two jobs: one leak breaks both (Ek C4, L8)
  const distinct = [
    "JWT_SECRET",
    "COOKIE_SECRET",
    "CP_HASH_KEY",
    "AUTH_MFA_ENCRYPTION_KEY",
  ] as const
  distinct.forEach((name, index) => {
    const earlier = distinct
      .slice(0, index)
      .find((other) => env[other].toLowerCase() === env[name].toLowerCase())
    if (earlier) {
      ctx.addIssue({ code: "custom", path: [name], message: `must differ from ${earlier}` })
    }
  })
  // Each master key differs from the other keys and from each other
  const masters = env.CP_MASTER_KEY.split(",").map((key) => key.trim().toLowerCase())
  const reused = distinct.find((other) => masters.includes(env[other].toLowerCase()))
  if (reused || new Set(masters).size !== masters.length) {
    ctx.addIssue({
      code: "custom",
      path: ["CP_MASTER_KEY"],
      message: reused ? `must differ from ${reused}` : "lists the same key twice",
    })
  }
  try {
    parseAgeRecipients(env.CP_ESCROW_RECIPIENTS, "CP_ESCROW_RECIPIENTS")
  } catch (error) {
    // The message names the variable, never a value
    const message = error instanceof EscrowError ? error.message : "is not a list of age recipients"
    ctx.addIssue({
      code: "custom",
      path: ["CP_ESCROW_RECIPIENTS"],
      message: message.replace(/^CP_ESCROW_RECIPIENTS /, ""),
    })
  }
  const domainProblem = deployed ? publicDomainProblem(env.PLATFORM_DOMAIN) : null
  if (domainProblem) {
    ctx.addIssue({
      code: "custom",
      path: ["PLATFORM_DOMAIN"],
      message: `${domainProblem} outside development and test`,
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
