import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { signRequest, verifyDocument } from "@qticaret/server-kit"
import {
  PLAN_DOCUMENT_MAX_BYTES,
  PLAN_PULL_PURPOSE,
  planPullBinding,
  planPullResponseSchema,
} from "@qticaret/types/control-plane"
import { errorSummary, logger } from "../logging"
import { CONTROL_PLANE_MODULE } from "../../modules/control-plane"
import type ControlPlaneModuleService from "../../modules/control-plane/service"
import { controlPlaneConfig, tenantSigner } from "./config"
import { receivePlanDocument } from "./receive"
import type { ReceiveResult } from "./receive"

export const PLAN_PATH = "/tenant-api/v1/plan"
const PULL_TIMEOUT_MS = 10_000
// The document and its binding around it
const PULL_MAX_BYTES = PLAN_DOCUMENT_MAX_BYTES + 1024
/** How long the shop may hear nothing before it says so (adr/0061 §3.3). */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export type Fetch = (url: string, init: RequestInit) => Promise<Response>

export type PullResult =
  ReceiveResult | { outcome: "not_configured" | "unreachable" | "none" | "bad_answer" }

/** The answer's bytes, at most `limit`; null past it (the rest is not read). */
async function readCapped(response: Response, limit: number): Promise<string | null> {
  const reader = response.body?.getReader()
  if (!reader) {
    return ""
  }
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > limit) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString("utf8")
}

/**
 * The pull (adr/0061 §3.2, Ek C9): `GET CONTROL_PLANE_URL/tenant-api/v1/plan`
 * signed with `TENANT_SIGNING_KEY`. The answer must carry the control
 * plane's signature over this request's own nonce and the document (review
 * L3): an old or replayed answer is refused. The document is then checked
 * exactly as a push, and only such a pull moves `confirmed_at`.
 * No retry inside a run (a signed request's nonce is single-use; the next
 * run is the retry), no redirect, ten seconds, 16 KB. The control plane
 * unreachable or refusing changes nothing: the shop keeps its last
 * document and its status (§3.3); the log says why, by code.
 */
export async function pullPlanDocument(
  container: MedusaContainer,
  options: { fetch?: Fetch } = {}
): Promise<PullResult> {
  const config = controlPlaneConfig()
  if (!config.managed) {
    return { outcome: "unmanaged" }
  }
  const signer = tenantSigner()
  if (!signer || !config.url || !config.tenantId) {
    return { outcome: "not_configured" }
  }
  const nonce = randomBytes(16).toString("base64url")
  const headers = signRequest({
    method: "GET",
    path: PLAN_PATH,
    tenantId: config.tenantId,
    body: "",
    signer,
    nonce,
  })
  let response: Response
  try {
    response = await (options.fetch ?? fetch)(`${config.url}${PLAN_PATH}`, {
      method: "GET",
      headers: { ...headers, accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(PULL_TIMEOUT_MS),
    })
  } catch (error) {
    logger.warn({ event: "control_plane.pull_unreachable", err: errorSummary(error) })
    return { outcome: "unreachable" }
  }
  const text = await readCapped(response, PULL_MAX_BYTES).catch(() => null)
  if (response.status === 404) {
    logger.info({ event: "control_plane.pull_none" })
    return { outcome: "none" }
  }
  if (response.status !== 200 || text === null) {
    logger.warn({
      event: "control_plane.pull_refused",
      status: response.status,
      tooLarge: text === null,
    })
    return { outcome: "bad_answer" }
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    logger.warn({ event: "control_plane.pull_refused", status: 200, reason: "not_json" })
    return { outcome: "bad_answer" }
  }
  const parsed = planPullResponseSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn({ event: "control_plane.pull_refused", status: 200, reason: "shape" })
    return { outcome: "bad_answer" }
  }
  const bound = verifyDocument(
    PLAN_PULL_PURPOSE,
    planPullBinding(nonce, parsed.data.plan),
    parsed.data.binding,
    (kid) => config.publicKeys.get(kid)
  )
  if (!bound.ok) {
    // Not an answer to this request: an old one replayed, or another's
    logger.warn({ event: "control_plane.pull_refused", status: 200, reason: bound.code })
    return { outcome: "bad_answer" }
  }
  return await receivePlanDocument(container, parsed.data.plan, "pull")
}

/**
 * A warning code when no pull has been answered for this shop's own nonce
 * for 24 hours (§3.3; F16's monitoring reads it; pushes do not count,
 * review L3). Nothing changes:
 * the shop sells on with its last document. True when it warned.
 */
export async function warnIfStale(container: MedusaContainer, now = new Date()): Promise<boolean> {
  const service = container.resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
  const state = await service.planState()
  if (!state.managed) {
    return false
  }
  const heard = state.confirmed_at ? new Date(state.confirmed_at).getTime() : null
  if (heard !== null && now.getTime() - heard < STALE_AFTER_MS) {
    return false
  }
  logger.warn({
    event: "control_plane.document_stale",
    code: heard === null ? "control_plane.no_document" : "control_plane.document_stale",
    serial: state.serial,
    confirmedAt: state.confirmed_at,
  })
  return true
}
