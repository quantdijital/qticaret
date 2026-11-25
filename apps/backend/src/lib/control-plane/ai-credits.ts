import { signRequest } from "@qticaret/server-kit"
import {
  AI_CREDITS_PATHS,
  AI_CREDITS_STATUS_MAX_BYTES,
  aiCreditsStatusReadSchema,
} from "@qticaret/types/control-plane"
import type { AiCreditsStatus } from "@qticaret/types/control-plane"
import { registerProcessCache } from "../cache/process-caches"
import { errorSummary, logger } from "../logging"
import { aiGatewayEndpoint } from "./ai-gateway"
import type { AiGatewayEndpoint } from "./ai-gateway"
import { readCapped } from "./pull"
import type { Fetch } from "./pull"

/**
 * The platform's credits as the control plane says (adr/0085 §2, §3):
 * `GET /tenant-api/v1/ai/credits`, signed, held to the contract, kept 60
 * seconds in this process. Closed by default: unmanaged, unconfigured,
 * unreachable, refused or of another shape, the credits are not
 * available (an unmanaged shop asks nobody). A failure is kept too, as
 * "not available", for a shorter while (`AI_CREDITS_FAILURE_CACHE_MS`):
 * while the control plane cannot be reached no AI request waits for it
 * again, and one warning is logged a window. One ask is in flight at a
 * time; those meanwhile wait for its answer. After each call on credits
 * the wallet left, from the gateway's headers, updates what is kept
 * (`noteAiCharge`).
 */

export const AI_CREDITS_CACHE_MS = 60_000
/** How long a failed ask counts as "not available" before the next one asks again. */
export const AI_CREDITS_FAILURE_CACHE_MS = 20_000
const STATUS_TIMEOUT_MS = 5_000

const UNAVAILABLE: AiCreditsStatus = Object.freeze({ available: false })

let kept: { at: number; status: AiCreditsStatus } | null = null
// When the last ask failed: "not available" until the window ends
let failedAt: number | null = null
// The ask in flight: those asking meanwhile wait for the same answer
let asking: Promise<AiCreditsStatus> | null = null
registerProcessCache(() => {
  kept = null
  failedAt = null
  asking = null
})

const within = (at: number, since: number, ms: number): boolean =>
  at - since >= 0 && at - since < ms

export interface AiCreditsStatusOptions {
  /** Tests only: where and how to sign; the shop's configuration otherwise. */
  endpoint?: AiGatewayEndpoint | null | undefined
  fetch?: Fetch | undefined
  now?: (() => number) | undefined
}

async function askControlPlane(
  endpoint: AiGatewayEndpoint,
  options: AiCreditsStatusOptions,
  at: number
): Promise<AiCreditsStatus | null> {
  const path = AI_CREDITS_PATHS.credits
  const headers = signRequest({
    method: "GET",
    path,
    tenantId: endpoint.tenantId,
    body: "",
    signer: endpoint.signer,
    now: at,
  })
  let response: Response
  try {
    response = await (options.fetch ?? fetch)(`${endpoint.url}${path}`, {
      method: "GET",
      headers: { ...headers, accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    })
  } catch (error) {
    logger.warn({ event: "ai_credits.status_unreachable", err: errorSummary(error) })
    return null
  }
  const text = await readCapped(response, AI_CREDITS_STATUS_MAX_BYTES).catch(() => null)
  if (response.status !== 200 || text === null) {
    logger.warn({ event: "ai_credits.status_refused", status: response.status })
    return null
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    logger.warn({ event: "ai_credits.status_refused", status: 200, reason: "not_json" })
    return null
  }
  // Read open: a field a newer control plane adds is dropped, not refused
  const parsed = aiCreditsStatusReadSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn({ event: "ai_credits.status_refused", status: 200, reason: "shape" })
    return null
  }
  return parsed.data
}

export async function aiCreditsStatus(
  options: AiCreditsStatusOptions = {}
): Promise<AiCreditsStatus> {
  const endpoint = options.endpoint === undefined ? aiGatewayEndpoint() : options.endpoint
  if (endpoint === null) {
    return UNAVAILABLE
  }
  const at = (options.now ?? Date.now)()
  if (kept !== null && within(at, kept.at, AI_CREDITS_CACHE_MS)) {
    return kept.status
  }
  if (failedAt !== null && within(at, failedAt, AI_CREDITS_FAILURE_CACHE_MS)) {
    return UNAVAILABLE
  }
  if (asking !== null) {
    return asking
  }
  const ask = askControlPlane(endpoint, options, at).then((status) => {
    if (status === null) {
      kept = null
      failedAt = at
      return UNAVAILABLE
    }
    kept = { at, status }
    failedAt = null
    return status
  })
  asking = ask
  try {
    return await ask
  } finally {
    // A forgetting meanwhile (tests) may have dropped it, or a later ask taken its place
    if (asking === ask) {
      asking = null
    }
  }
}

/** Forgets the kept status (a top-up request just opened): the next ask asks again. */
export function forgetAiCreditsStatus(): void {
  kept = null
}

/**
 * A call's charge and the wallet left after it (the gateway's headers):
 * the kept status follows without asking. The month's grant is spent
 * before bought credits, so a smaller wallet comes off the grant first.
 * A larger one (credits added meanwhile) cannot be split: it is
 * forgotten and the next ask fetches it.
 */
export function noteAiCharge(charge: { credits: number; balance: number }): void {
  const current = kept
  const status = current?.status
  if (current === null || !status?.available) {
    return
  }
  const { plan, purchased } = status.balance
  if (charge.balance > plan.remaining + purchased.remaining) {
    kept = null
    return
  }
  const bought = Math.min(purchased.remaining, charge.balance)
  kept = {
    at: current.at,
    status: {
      ...status,
      balance: {
        plan: { ...plan, remaining: charge.balance - bought },
        purchased: { ...purchased, remaining: bought },
      },
      daily: {
        ...status.daily,
        remaining: Math.max(0, status.daily.remaining - charge.credits),
      },
    },
  }
}
