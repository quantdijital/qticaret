import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, isLocalEnv } from "@qticaret/server-kit"
import type { PlanDocumentRow, PushOutcome } from "../../modules/fleet/service-documents"
import { fleetIn, tenantsIn } from "../../workflows/modules"
import { parseTenantApiHosts, pushTargetProblem, pushUrl } from "./push-target"
import type { PushPolicy } from "./push-target"

type Container = Pick<MedusaContainer, "resolve">

/** A push's tries: 1, 2, 4… minutes apart, at most an hour, then given up (the shop pulls). */
export const PUSH_MAX_ATTEMPTS = 12
const MINUTE = 60_000
const PUSH_TIMEOUT_MS = 5_000

export function nextPushAt(attempts: number, now: Date): Date | null {
  if (attempts >= PUSH_MAX_ATTEMPTS) {
    return null
  }
  return new Date(now.getTime() + Math.min(2 ** Math.max(attempts - 1, 0), 60) * MINUTE)
}

/** The push policy from the environment (lib/fleet/push-target.ts). */
export const pushPolicy = (env: NodeJS.ProcessEnv = process.env): PushPolicy => ({
  local: isLocalEnv({ NODE_ENV: env["NODE_ENV"] }),
  hosts: parseTenantApiHosts(env["CP_TENANT_API_HOSTS"]),
})

export type Fetch = (url: string, init: RequestInit) => Promise<Response>

/**
 * What a shop's answer means. 200 is taken (applied, or the same serial:
 * it already has it). A 5xx, a 429 or no answer is tried again later.
 * Any other answer is the shop refusing this document (a bad signature to
 * it, another serial, unmanaged): trying again would get the same answer.
 */
function outcomeOf(status: number, attempts: number, now: Date): PushOutcome {
  if (status === 200) {
    return { delivered: true }
  }
  const retry = status >= 500 || status === 429 || status === 408
  return {
    delivered: false,
    error: `http_${String(status)}`,
    next_push_at: retry ? nextPushAt(attempts, now) : null,
  }
}

/**
 * Pushes one document to its shop (`POST /hooks/control-plane/plan`):
 * the stored `{ document, kid, signature }` as JSON, no redirect followed,
 * five seconds at most, the answer's body never read. The outcome is
 * noted on the row; nothing is thrown.
 */
export async function pushPlanDocument(
  container: Container,
  row: PlanDocumentRow,
  options: { fetch?: Fetch; now?: Date; policy?: PushPolicy } = {}
): Promise<PushOutcome> {
  const now = options.now ?? new Date()
  const attempts = row.push_attempts + 1
  let outcome: PushOutcome
  try {
    const tenant = await tenantsIn(container).tenantOf(row.tenant_id)
    const problem = tenant.api_base_url
      ? pushTargetProblem(tenant.api_base_url, options.policy ?? pushPolicy())
      : "no_target"
    if (problem !== null || !tenant.api_base_url) {
      outcome = {
        delivered: false,
        error: problem ?? "no_target",
        next_push_at: nextPushAt(attempts, now),
      }
    } else {
      const response = await (options.fetch ?? fetch)(pushUrl(tenant.api_base_url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          document: row.document,
          kid: row.kid,
          signature: row.signature,
        }),
        redirect: "manual",
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      })
      await response.body?.cancel().catch(() => undefined)
      outcome = outcomeOf(response.status, attempts, now)
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError"
    outcome = {
      delivered: false,
      error: timedOut ? "timeout" : "unreachable",
      next_push_at: nextPushAt(attempts, now),
    }
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `cp.plan_push_failed ${JSON.stringify({ tenant_id: row.tenant_id, serial: row.serial, err: errorSummary(error) })}`
      )
  }
  await fleetIn(container).notePlanPush(row.id, outcome)
  return outcome
}

/** Every push that is due, one after another (the job). The count delivered. */
export async function deliverDuePushes(
  container: Container,
  options: { fetch?: Fetch; now?: Date; policy?: PushPolicy } = {}
): Promise<{ tried: number; delivered: number }> {
  const due = await fleetIn(container).duePlanPushes(options.now ?? new Date())
  let delivered = 0
  for (const row of due) {
    if ((await pushPlanDocument(container, row, options)).delivered) {
      delivered += 1
    }
  }
  return { tried: due.length, delivered }
}
