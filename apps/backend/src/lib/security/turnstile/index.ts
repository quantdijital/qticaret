import { randomUUID } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import { ProviderError } from "../../errors"
import type { HttpClient, Transport } from "../../clients"
import type { FailureLog } from "../../clients/failure-log"
import {
  TURNSTILE_DUMMY_TOKEN,
  TURNSTILE_TEST_SECRET_PASS,
  TURNSTILE_TEST_SECRET_SPENT,
  isTurnstileTestSecret,
} from "./keys"

export * from "./keys"

/**
 * Cloudflare Turnstile at the risky gates (adr/0044 Ek 2026-11-24): the
 * browser's widget gives a token, the gate asks Cloudflare's siteverify
 * whether it is good, for this gate's action and one of the shop's own
 * hosts. A token is never logged, nor the secret: the log has the gate and
 * Cloudflare's error codes only.
 */

/** The request header a client sends the widget's token in. */
export const TURNSTILE_HEADER = "x-turnstile-token"

/**
 * The gates, each its own widget `action` (Cloudflare: up to 32 of
 * `[A-Za-z0-9_-]`): a token made for the newsletter box does not open a
 * sign-in.
 */
export const TURNSTILE_GATES = [
  "login",
  "register",
  "password_reset",
  "checkout",
  "staff_login",
  // Medusa's own staff account creation (an invitation's acceptance)
  "staff_register",
  "staff_password_reset",
  // A new e-mail verification code (Medusa's `/auth/verification/request`)
  "verification",
  "order_lookup",
  "contact",
  "newsletter",
  "gift_card",
  "review",
  "question",
  "stock_alert",
] as const
export type TurnstileGate = (typeof TURNSTILE_GATES)[number]

// Cloudflare's own bound on a token, in the characters its tokens are made of
const TOKEN = /^[A-Za-z0-9._-]{1,2048}$/
// Cloudflare's error codes are short words; anything else is not logged as said
const ERROR_CODE = /^[a-z0-9-]{1,40}$/

export type TurnstileVerdict =
  | { ok: true }
  /** The token is not good for this gate: missing, refused, spent, another action or host. */
  | { ok: false; reason: "missing" | "refused" | "action" | "hostname"; codes: string[] }
  /** Cloudflare could not say (down, slow, our own secret refused): the fallback decides. */
  | { ok: false; reason: "unavailable"; codes: string[] }

export interface TurnstileCheck {
  token: string | undefined
  secret: string
  gate: TurnstileGate
  /** The visitor's address, when known: Cloudflare weighs it. */
  remoteIp: string | null
  /** The shop's own hosts, lower case; a token from any other is refused. */
  hostnames: ReadonlySet<string>
}

const answer = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  challenge_ts: z.string().optional(),
})

// Our own secret refused, or Cloudflare's own failure: it cannot judge the visitor
export const SECRET_REFUSED: ReadonlySet<string> = new Set([
  "missing-input-secret",
  "invalid-input-secret",
])
const NOT_JUDGED: ReadonlySet<string> = new Set([...SECRET_REFUSED, "internal-error"])

// Nothing kept on the Integrations page: the panel is for the shop, this is the platform's
const NO_FAILURE_LOG: FailureLog = {
  note: () => Promise.resolve(),
  recent: () => Promise.resolve([]),
}

export interface TurnstileClientOptions {
  transport?: Transport
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

/**
 * siteverify behind the platform's HTTP client: 2 s a try, one retry with
 * the same idempotency key (Cloudflare does not count it as a reuse), and
 * the circuit breaker, so an outage answers at once instead of waiting.
 */
export function createTurnstileClient(options: TurnstileClientOptions = {}): HttpClient {
  return createHttpClient({
    provider: "turnstile",
    baseUrl: "https://challenges.cloudflare.com",
    timeoutMs: 2_000,
    maxResponseBytes: 16 * 1024,
    retry: { attempts: 2, baseDelayMs: 100, maxDelayMs: 300, maxRetryAfterMs: 0 },
    failureLog: () => NO_FAILURE_LOG,
    // A 4xx's own word (`bad-request`); a 5xx or a 429 stays `http_<status>`
    errorCode: (body, status) =>
      status >= 500 || status === 429
        ? undefined
        : answer.safeParse(body).data?.["error-codes"]?.[0],
    ...options,
  })
}

const codesOf = (raw: string[] | undefined): string[] =>
  (raw ?? []).filter((code) => ERROR_CODE.test(code)).slice(0, 5)

/**
 * What Cloudflare documents for its test secrets, answered here in tests:
 * the pass key takes the dummy token only, the fail key nothing, the
 * spent key answers as a reused token. The hostname (`example.com`) and
 * action (none) a test key gives are not checked.
 */
function testAnswer(secret: string, token: string): z.infer<typeof answer> {
  if (secret === TURNSTILE_TEST_SECRET_PASS && token === TURNSTILE_DUMMY_TOKEN) {
    return { success: true, hostname: "example.com" }
  }
  return {
    success: false,
    "error-codes": [
      secret === TURNSTILE_TEST_SECRET_SPENT ? "timeout-or-duplicate" : "invalid-input-response",
    ],
  }
}

export interface VerifyOptions {
  client: HttpClient
  /**
   * A developer's machine or the tests (`isLocalEnv`): Cloudflare's test
   * secrets keep their privileges (no host or action to check) only there.
   */
  local?: boolean
  /** Answer Cloudflare's test secrets here, without the network (NODE_ENV=test). */
  offlineTestKeys?: boolean
}

/**
 * What a failed call says. Cloudflare down, slow, throttling us or our own
 * secret refused: unavailable (the fallback decides). Any other 4xx is the
 * token's or the request's: refused.
 */
function failedCall(error: unknown): TurnstileVerdict {
  if (error instanceof ProviderError) {
    const code = error.providerCode
    if (NOT_JUDGED.has(code)) {
      return { ok: false, reason: "unavailable", codes: [code] }
    }
    if (/^http_4\d\d$/.test(code) && code !== "http_429") {
      return { ok: false, reason: "refused", codes: [] }
    }
    // Cloudflare's words are hyphenated (`bad-request`); the client's own are not (`aborted`)
    if (code.includes("-") && ERROR_CODE.test(code)) {
      return { ok: false, reason: "refused", codes: [code] }
    }
  }
  return { ok: false, reason: "unavailable", codes: [] }
}

/** Asks Cloudflare whether the token is good for the gate, on one of the shop's hosts. */
export async function verifyTurnstile(
  check: TurnstileCheck,
  options: VerifyOptions
): Promise<TurnstileVerdict> {
  const token = check.token?.trim() ?? ""
  if (token === "") {
    return { ok: false, reason: "missing", codes: [] }
  }
  if (!TOKEN.test(token)) {
    return { ok: false, reason: "refused", codes: ["invalid-input-response"] }
  }
  const testKey = isTurnstileTestSecret(check.secret) && options.local === true
  let said: z.infer<typeof answer>
  if (testKey && options.offlineTestKeys) {
    said = testAnswer(check.secret, token)
  } else {
    try {
      said = await options.client.request({
        method: "POST",
        path: "/turnstile/v0/siteverify",
        json: {
          secret: check.secret,
          response: token,
          ...(check.remoteIp ? { remoteip: check.remoteIp } : {}),
          idempotency_key: randomUUID(),
        },
        // The idempotency key makes a repeat safe; the token stays out of any log
        idempotent: true,
        secrets: [check.secret, token],
        schema: answer,
      })
    } catch (error) {
      return failedCall(error)
    }
  }
  const codes = codesOf(said["error-codes"])
  if (!said.success) {
    return codes.some((code) => NOT_JUDGED.has(code))
      ? { ok: false, reason: "unavailable", codes }
      : { ok: false, reason: "refused", codes }
  }
  // A test key answers `example.com` and no action: its pass is the test's, not a shop's
  if (testKey) {
    return { ok: true }
  }
  if (said.action !== check.gate) {
    return { ok: false, reason: "action", codes }
  }
  if (!check.hostnames.has((said.hostname ?? "").toLowerCase())) {
    return { ok: false, reason: "hostname", codes }
  }
  return { ok: true }
}
