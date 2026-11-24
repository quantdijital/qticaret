import { z } from "@medusajs/framework/zod"
import { EnvValidationError, isLocalEnv } from "@qticaret/server-kit"
import { TURNSTILE_TEST_SECRET_PASS, TURNSTILE_TEST_SITE_KEY, isTurnstileTestKey } from "./keys"

/**
 * Turnstile's variables in the shop's env schema (adr/0044 Ek 2026-11-24).
 * The keys are the platform's: the control plane makes a widget per shop
 * at provisioning (F16) and sets both here; never in the panel or the
 * database. Unset on a developer's machine and in tests, Cloudflare's
 * always-pass test keys stand in; once deployed both are required, and a
 * test key (which lets anyone through) is refused. Messages name the
 * variable, never its value.
 */

const KEY = /^[A-Za-z0-9_-]{10,200}$/

export const TURNSTILE_ENV = {
  // The widget's public site key, given to the storefront and the panel's sign-in
  TURNSTILE_SITE_KEY: z.string().regex(KEY, "must be a Turnstile site key").optional(),
  // Its secret, for siteverify only
  TURNSTILE_SECRET_KEY: z.string().regex(KEY, "must be a Turnstile secret key").optional(),
  // More hosts a token may come from (a preview domain), comma separated, beside
  // the shop's own (its domain, STOREFRONT_ORIGIN, BACKEND_URL)
  TURNSTILE_ALLOWED_HOSTNAMES: z
    .string()
    .max(2000)
    .refine(
      (value) =>
        value
          .split(",")
          .map((host) => host.trim())
          .every((host) => /^[a-z0-9.-]{1,253}$/i.test(host)),
      "must be a comma-separated list of host names"
    )
    .optional(),
  // Behind Cloudflare: take the visitor's address from CF-Connecting-IP. Only when the
  // origin answers Cloudflare alone (firewall, F16), else anyone could write it
  TRUST_CF_CONNECTING_IP: z.enum(["on", "off"]).optional(),
  // Development and tests only: `off` asks no token (the panel's e2e until its sign-in
  // draws the widget, a load test); refused anywhere else
  TURNSTILE: z.enum(["on", "off"]).optional(),
}

type TurnstileEnv = { [K in keyof typeof TURNSTILE_ENV]?: string | undefined } & {
  NODE_ENV?: string | undefined
}

/**
 * Both keys or none; outside development and tests (an unset NODE_ENV
 * counts as live) never a test key, which lets anyone through.
 */
export function checkTurnstileEnv(
  env: TurnstileEnv,
  issue: (path: string, message: string) => void
): void {
  const site = env.TURNSTILE_SITE_KEY
  const secret = env.TURNSTILE_SECRET_KEY
  if ((site === undefined) !== (secret === undefined)) {
    issue(
      site === undefined ? "TURNSTILE_SITE_KEY" : "TURNSTILE_SECRET_KEY",
      "is required with the other Turnstile key"
    )
  }
  if (isLocalEnv(env)) {
    return
  }
  if (env.TURNSTILE === "off") {
    issue("TURNSTILE", "is allowed off on development and test only")
  }
  for (const [name, value] of [
    ["TURNSTILE_SITE_KEY", site],
    ["TURNSTILE_SECRET_KEY", secret],
  ] as const) {
    if (value !== undefined && isTurnstileTestKey(value)) {
      issue(name, "must not be a Cloudflare test key outside development and test")
    }
  }
}

/**
 * Outside development and tests (an unset NODE_ENV counts as live) the
 * shop starts with both keys only. Called at boot after the schema, as
 * the control plane's rule is (medusa-config.ts); throws the schema's own
 * error, naming the variables, never their values.
 */
export function assertTurnstileConfigured(env: TurnstileEnv): void {
  if (isLocalEnv(env)) {
    return
  }
  const missing = (["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] as const).filter(
    (name) => env[name] === undefined
  )
  if (missing.length > 0) {
    throw new EnvValidationError(
      `Invalid environment configuration:\n${missing
        .map((name) => `  - ${name}: is required outside development and test`)
        .join("\n")}`
    )
  }
}

/** Whether a developer turned Turnstile off (never anywhere but development and tests). */
export const isTurnstileOff = (env: TurnstileEnv): boolean =>
  env.TURNSTILE === "off" && isLocalEnv(env)

export interface TurnstileKeys {
  siteKey: string
  secretKey: string
}

/**
 * The keys in use: the env's, else on a developer's machine and in tests
 * Cloudflare's always-pass test keys. Null only where the shop would not
 * have started (`assertTurnstileConfigured`).
 */
export function turnstileKeys(env: TurnstileEnv): TurnstileKeys | null {
  if (env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY) {
    return { siteKey: env.TURNSTILE_SITE_KEY, secretKey: env.TURNSTILE_SECRET_KEY }
  }
  return isLocalEnv(env)
    ? { siteKey: TURNSTILE_TEST_SITE_KEY, secretKey: TURNSTILE_TEST_SECRET_PASS }
    : null
}
