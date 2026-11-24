import { randomBytes } from "node:crypto"
import { signRequest, verifyDocument } from "@qticaret/server-kit"
import {
  BILLING_HISTORY_MAX_BYTES,
  BILLING_HISTORY_PURPOSE,
  billingHistoryBinding,
  billingHistoryResponseSchema,
} from "@qticaret/types/control-plane"
import type { BillingRecord } from "@qticaret/types/control-plane"
import { errorSummary, logger } from "../logging"
import { controlPlaneConfig, tenantSigner } from "./config"
import { readCapped } from "./pull"
import type { Fetch } from "./pull"
import { registerProcessCache } from "../cache/process-caches"

export const BILLING_PATH = "/tenant-api/v1/billing"
const TIMEOUT_MS = 5_000
/** A good answer is kept a minute; a failed one half a minute (the panel's retries do not hammer). */
export const HISTORY_CACHE_MS = 60_000
export const HISTORY_FAILURE_CACHE_MS = 30_000

/**
 * The shop's payment history as Settings > Abonelik shows it (adr/0061
 * Ek C20). `unmanaged`: no control plane (development, tests), no
 * history. `unavailable`: it could not be read now (unreachable, refused,
 * an older control plane without the route, an answer that did not
 * verify); the panel says so and the rest of the page stands.
 */
export type PaymentHistory =
  { state: "ok"; records: BillingRecord[] } | { state: "unmanaged" | "unavailable"; records: [] }

let cached: { key: string; until: number; value: PaymentHistory } | null = null
let inflight: { key: string; promise: Promise<PaymentHistory> } | null = null
// A bundled test run's next spec file reads the history afresh
registerProcessCache(() => {
  cached = null
  inflight = null
})

/** Forget the kept answer (tests, and nothing else). */
export function forgetPaymentHistory(): void {
  cached = null
  inflight = null
}

const unavailable = (): PaymentHistory => ({ state: "unavailable", records: [] })

/**
 * `GET CONTROL_PLANE_URL/tenant-api/v1/billing`, signed with
 * `TENANT_SIGNING_KEY` as the plan's pull (Ek C9): plain fetch, no redirect,
 * no retry (the nonce is single-use), five seconds, 24 KB. The answer is
 * shown only when it is the contract's strict shape, for this shop's id,
 * and signed by a key in `CONTROL_PLANE_PUBLIC_KEYS` over this request's
 * own nonce (a replayed or forged answer, its invoice links included,
 * never reaches the panel). Kept a minute per process; one call at a time.
 * Nothing is thrown: a failure is logged by code.
 */
export async function readPaymentHistory(
  options: { fetch?: Fetch; now?: number } = {}
): Promise<PaymentHistory> {
  const config = controlPlaneConfig()
  if (!config.managed) {
    return { state: "unmanaged", records: [] }
  }
  const signer = tenantSigner()
  if (!signer || !config.url || !config.tenantId) {
    return unavailable()
  }
  const key = `${config.url} ${config.tenantId}`
  const now = options.now ?? Date.now()
  if (cached?.key === key && cached.until > now) {
    return cached.value
  }
  if (inflight?.key === key) {
    return await inflight.promise
  }
  const promise = fetchHistory(config.url, config.tenantId, signer, config.publicKeys, options)
    .catch((error: unknown) => {
      logger.warn({ event: "control_plane.billing_failed", err: errorSummary(error) })
      return unavailable()
    })
    .then((value) => {
      const ttl = value.state === "ok" ? HISTORY_CACHE_MS : HISTORY_FAILURE_CACHE_MS
      cached = { key, until: now + ttl, value }
      return value
    })
    .finally(() => {
      if (inflight?.promise === promise) {
        inflight = null
      }
    })
  inflight = { key, promise }
  return await promise
}

async function fetchHistory(
  url: string,
  tenantId: string,
  signer: NonNullable<ReturnType<typeof tenantSigner>>,
  publicKeys: ReturnType<typeof controlPlaneConfig>["publicKeys"],
  options: { fetch?: Fetch }
): Promise<PaymentHistory> {
  const nonce = randomBytes(16).toString("base64url")
  const headers = signRequest({
    method: "GET",
    path: BILLING_PATH,
    tenantId,
    body: "",
    signer,
    nonce,
  })
  let response: Response
  try {
    response = await (options.fetch ?? fetch)(`${url}${BILLING_PATH}`, {
      method: "GET",
      headers: { ...headers, accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    logger.warn({ event: "control_plane.billing_unreachable", err: errorSummary(error) })
    return unavailable()
  }
  const text = await readCapped(response, BILLING_HISTORY_MAX_BYTES).catch(() => null)
  if (response.status !== 200 || text === null) {
    logger.warn({
      event: "control_plane.billing_refused",
      status: response.status,
      tooLarge: text === null,
    })
    return unavailable()
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    logger.warn({ event: "control_plane.billing_refused", status: 200, reason: "not_json" })
    return unavailable()
  }
  const parsed = billingHistoryResponseSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn({ event: "control_plane.billing_refused", status: 200, reason: "shape" })
    return unavailable()
  }
  const { history, binding } = parsed.data
  if (history.tenant_id !== tenantId) {
    logger.warn({ event: "control_plane.billing_refused", status: 200, reason: "wrong_tenant" })
    return unavailable()
  }
  const bound = verifyDocument(
    BILLING_HISTORY_PURPOSE,
    billingHistoryBinding(nonce, history),
    binding,
    (kid) => publicKeys.get(kid)
  )
  if (!bound.ok) {
    logger.warn({ event: "control_plane.billing_refused", status: 200, reason: bound.code })
    return unavailable()
  }
  return { state: "ok", records: history.records }
}
