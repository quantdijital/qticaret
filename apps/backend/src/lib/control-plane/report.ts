import type { MedusaContainer } from "@medusajs/framework/types"
import { signRequest } from "@qticaret/server-kit"
import { errorSummary, logger } from "../logging"
import { controlPlaneConfig, tenantSigner } from "./config"
import type { Fetch } from "./pull"
import { runningRelease } from "./release"
import type { Release } from "./release"
import { buildUsageReport, readUsageCounts } from "./usage"

export const USAGE_PATH = "/tenant-api/v1/usage"
const REPORT_TIMEOUT_MS = 10_000

export type ReportResult =
  | { outcome: "unmanaged" | "not_configured" | "unreachable" | "sent" }
  | { outcome: "count_failed" | "refused"; status?: number }

/**
 * The hourly usage report (adr/0061 §5.4, Ek C13): the shop's totals,
 * `POST CONTROL_PLANE_URL/tenant-api/v1/usage`, signed with
 * `TENANT_SIGNING_KEY` over the exact body bytes. The pull's transport
 * rules (Ek C9): plain fetch, never retried inside a run (a signed
 * request's nonce is single-use; the next hour is the retry), no redirect,
 * ten seconds, the answer's body never read. Unmanaged or without the
 * pull's two variables, nothing is sent. Nothing is thrown: the outcome
 * goes to the log by code and never touches the shop.
 */
export async function sendUsageReport(
  container: Pick<MedusaContainer, "resolve">,
  options: { fetch?: Fetch; now?: Date; release?: Release } = {}
): Promise<ReportResult> {
  const config = controlPlaneConfig()
  if (!config.managed) {
    return { outcome: "unmanaged" }
  }
  const signer = tenantSigner()
  if (!signer || !config.url || !config.tenantId) {
    return { outcome: "not_configured" }
  }
  const now = options.now ?? new Date()
  const release = options.release ? { ...options.release, known: true } : runningRelease()
  if (!release.known) {
    // Sent all the same, with the commit as zeros: the counts still matter
    logger.warn({ event: "control_plane.release_unknown" })
  }
  let body: string
  try {
    const counts = await readUsageCounts(container, now)
    body = JSON.stringify(buildUsageReport(config.tenantId, counts, release, now))
  } catch (error) {
    logger.error({ event: "control_plane.usage_count_failed", err: errorSummary(error) })
    return { outcome: "count_failed" }
  }
  const headers = signRequest({
    method: "POST",
    path: USAGE_PATH,
    tenantId: config.tenantId,
    body,
    signer,
  })
  let response: Response
  try {
    response = await (options.fetch ?? fetch)(`${config.url}${USAGE_PATH}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json", accept: "application/json" },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    })
  } catch (error) {
    logger.warn({ event: "control_plane.usage_unreachable", err: errorSummary(error) })
    return { outcome: "unreachable" }
  }
  // The answer says nothing the shop acts on: not read
  await response.body?.cancel().catch(() => undefined)
  if (response.status !== 200) {
    logger.warn({ event: "control_plane.usage_refused", status: response.status })
    return { outcome: "refused", status: response.status }
  }
  logger.info({ event: "control_plane.usage_sent" })
  return { outcome: "sent" }
}
