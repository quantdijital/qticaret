import { createHash } from "node:crypto"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isLocalEnv, parseEnv, panelUrl, storefrontOrigin, backendUrl } from "../../lib/env"
import type { Env } from "../../lib/env"
import { errorSummary, logger } from "../../lib/logging"
import type { HttpClient } from "../../lib/clients"
import { BASE_BITS, fallbackScope } from "../../lib/security/challenge"
import { perIpScale } from "../../lib/security/rate-limit"
import {
  SECRET_REFUSED,
  TURNSTILE_HEADER,
  createTurnstileClient,
  isTurnstileTestSecret,
  verifyTurnstile,
} from "../../lib/security/turnstile"
import type { TurnstileGate } from "../../lib/security/turnstile"
import { isTurnstileOff, turnstileKeys } from "../../lib/security/turnstile/env"
import type { TurnstileKeys } from "../../lib/security/turnstile/env"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SeoSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { SoftLimit } from "./challenge"
import { challengePassed, demandChallenge } from "./challenge"
import { clientBucket, sharedRateLimitStore } from "./rate-limit"
import { clientIp } from "./client-ip"
import { rejectRequest } from "./reject"
import { registerProcessCache } from "../../lib/cache/process-caches"

/**
 * Cloudflare Turnstile at the risky gates (adr/0044 Ek 2026-11-24). The
 * client sends the widget's token in `X-Turnstile-Token`; the gate asks
 * Cloudflare. Without one: 428 `fraud.turnstile_required`; a token not good
 * here (refused, spent, made for another gate or host): 403
 * `fraud.turnstile_failed`. When Cloudflare cannot answer, neither open nor
 * shut: our proof of work stands in (428 `fraud.challenge_required` with
 * `fallback: "turnstile_unavailable"`), answered in `X-Turnstile-Fallback`.
 */

/** Where a client answers the proof asked in Turnstile's stead. */
export const TURNSTILE_FALLBACK_HEADER = "x-turnstile-fallback"

// Cloudflare's tokens live 5 minutes: one taken here is kept as long
const TOKEN_TTL_MS = 5 * 60 * 1000

let client: HttpClient | undefined
let keys: TurnstileKeys | null | undefined
// A new client (and circuit breaker) and keys per spec file of a bundled test run
registerProcessCache(() => {
  client = undefined
  keys = undefined
})

/** Tests give a client of their own, and change the environment between runs. */
export function resetTurnstile(given?: HttpClient): void {
  client = given
  keys = undefined
}

const keysOf = () => (keys === undefined ? (keys = turnstileKeys(parseEnv())) : keys)

const hostOf = (origin: string | null): string[] => {
  try {
    return origin ? [new URL(origin).hostname.toLowerCase()] : []
  } catch {
    return []
  }
}

/**
 * The hosts a token may be made on: the shop's domain (and its `www.`
 * twin), the storefront's and the backend's (the panel's) origins, the
 * operator's extra list; locally the developer's own.
 */
export async function shopHostnames(req: MedusaRequest, env: Env): Promise<Set<string>> {
  const hosts = new Set<string>([
    ...hostOf(storefrontOrigin(env)),
    ...hostOf(backendUrl(env)),
    ...hostOf(panelUrl(env)),
    ...(env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  ])
  if (isLocalEnv(env)) {
    hosts.add("localhost").add("127.0.0.1")
  }
  try {
    const seo = (await req.scope
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("seo")) as unknown as SeoSettings
    const domain = seo.canonical_host
    if (domain) {
      hosts.add(domain)
      hosts.add(domain.startsWith("www.") ? domain.slice(4) : `www.${domain}`)
    }
  } catch (error) {
    logger.error({ event: "security.turnstile_hosts_failed", err: errorSummary(error) })
  }
  return hosts
}

type Outcome = "passed" | "missing" | "refused" | "unavailable"

// A token taken once here is not taken again, even before Cloudflare's own
// reuse check (eventually consistent) would see it
async function firstUse(token: string): Promise<boolean> {
  const digest = createHash("sha256").update(token.trim(), "utf8").digest("hex").slice(0, 32)
  const { count } = await sharedRateLimitStore().hit(`fraud:turnstile:used:${digest}`, TOKEN_TTL_MS)
  return count === 1
}

/** Whether the request passes the gate's Turnstile, or why not. */
export async function turnstileOutcome(req: MedusaRequest, gate: TurnstileGate): Promise<Outcome> {
  if (
    req.headers[TURNSTILE_FALLBACK_HEADER] !== undefined &&
    (await challengePassed(req, fallbackScope(gate), BASE_BITS, TURNSTILE_FALLBACK_HEADER))
  ) {
    return "passed"
  }
  const env = parseEnv()
  if (isTurnstileOff(env)) {
    return "passed"
  }
  const pair = keysOf()
  if (pair === null) {
    // A deployed start without keys is refused (assertTurnstileConfigured): never here
    // but by mistake, and then every visitor pays the fallback: alert-worthy
    logger.error({ event: "security.turnstile_unconfigured", gate })
    return "unavailable"
  }
  const header = req.headers[TURNSTILE_HEADER]
  const token = typeof header === "string" ? header : undefined
  const verdict = await verifyTurnstile(
    {
      token,
      secret: pair.secretKey,
      gate,
      remoteIp: clientIp(req),
      hostnames: await shopHostnames(req, env),
    },
    {
      client: (client ??= createTurnstileClient()),
      local: isLocalEnv(env),
      offlineTestKeys: env.NODE_ENV === "test",
    }
  )
  if (verdict.ok) {
    // The dummy token is every test's, on a developer's machine only
    const testToken = isLocalEnv(env) && isTurnstileTestSecret(pair.secretKey)
    if (testToken || (await firstUse(token ?? ""))) {
      return "passed"
    }
    logger.info({ event: "security.turnstile_refused", gate, reason: "reused", codes: [] })
    return "refused"
  }
  if (verdict.reason === "unavailable") {
    // Our own secret refused never mends by itself: every visitor pays the fallback
    const secretRefused = verdict.codes.some((code) => SECRET_REFUSED.has(code))
    logger[secretRefused ? "error" : "warn"]({
      event: secretRefused ? "security.turnstile_secret_refused" : "security.turnstile_unavailable",
      gate,
      codes: verdict.codes,
    })
    return "unavailable"
  }
  if (verdict.reason !== "missing") {
    logger.info({
      event: "security.turnstile_refused",
      gate,
      reason: verdict.reason,
      codes: verdict.codes,
    })
    return "refused"
  }
  return "missing"
}

// The fallback's asks from one address in a quarter of an hour: harder past each step
const FALLBACK_WINDOW_MS = 15 * 60 * 1000
const FALLBACK_STEPS = [
  { over: 10, bits: BASE_BITS + 4 },
  { over: 3, bits: BASE_BITS + 2 },
] as const

/** The fallback's difficulty for the `count`th ask from one address: 18, then 20, then 22 bits. */
export const fallbackBits = (count: number): number =>
  FALLBACK_STEPS.find((step) => count > step.over * perIpScale())?.bits ?? BASE_BITS

async function refuse(
  req: MedusaRequest,
  res: MedusaResponse,
  gate: TurnstileGate,
  outcome: Exclude<Outcome, "passed">
): Promise<void> {
  if (outcome === "unavailable") {
    const { count } = await sharedRateLimitStore().hit(
      `fraud:turnstile:fallback:${gate}:${clientBucket(req)}`,
      FALLBACK_WINDOW_MS
    )
    demandChallenge(req, res, fallbackScope(gate), fallbackBits(count), {
      fallback: "turnstile_unavailable",
    })
    return
  }
  const missing = outcome === "missing"
  rejectRequest(
    req,
    res,
    missing ? 428 : 403,
    {
      type: "not_allowed",
      message: missing ? "fraud.turnstile_required" : "fraud.turnstile_failed",
      turnstile: { action: gate },
    },
    missing ? "turnstile_required" : "turnstile_failed"
  )
}

/** A gate that asks Turnstile of every request (sign-ins, registration, resets, paying). */
export function requireTurnstile(gate: TurnstileGate) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    if (req.method !== "POST") {
      next()
      return
    }
    try {
      const outcome = await turnstileOutcome(req, gate)
      if (outcome === "passed") {
        next()
        return
      }
      await refuse(req, res, gate, outcome)
    } catch (error) {
      next(error)
    }
  }
}

/**
 * A gate that asks Turnstile past `limit` requests from one address in its
 * window (the counters the proof of work counted with, adr/0044 §1); below
 * it nothing is asked. Per address, so scaled as the rate limits are in
 * integration tests.
 */
export function turnstileOver(gate: TurnstileGate, limit: SoftLimit) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    if (req.method !== "POST") {
      next()
      return
    }
    try {
      const { count } = await sharedRateLimitStore().hit(
        `fraud:challenge:${gate}:${clientBucket(req)}`,
        limit.windowMs
      )
      if (count <= limit.max * perIpScale()) {
        next()
        return
      }
      const outcome = await turnstileOutcome(req, gate)
      if (outcome === "passed") {
        next()
        return
      }
      await refuse(req, res, gate, outcome)
    } catch (error) {
      next(error)
    }
  }
}
