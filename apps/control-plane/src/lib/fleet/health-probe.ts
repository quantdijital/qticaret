import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { HealthTarget } from "../../modules/fleet/models/health"
import type { TenantRecord } from "../../modules/tenants/types"
import { isVerifiedDomain } from "../tenants/kinds"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { fleetIn, tenantsIn } from "../../workflows/modules"
import { eachBounded } from "./bounded"
import { PROBE_CONCURRENCY, PROBE_TIMEOUT_MS, statusOutcome } from "./health-rules"
import type { ProbeResult } from "./health-rules"
import { pinPolicy, probePinned } from "./pinned-probe"
import type { PinPolicy } from "./pinned-probe"
import { pushPolicy, pushTargetProblem } from "./push-target"
import type { PushPolicy } from "./push-target"
import { storefrontPolicy, storefrontTargetProblem } from "./storefront-target"

type Container = Pick<MedusaContainer, "resolve">
export type Fetch = (url: string, init: RequestInit) => Promise<Response>

/**
 * The statuses whose shops are probed, per target (adr/0061 §2, Ek C19
 * L2): a restricted or suspended shop keeps running and its backend still
 * answers; a suspended storefront answers its 503 on purpose (§5.5), so
 * it is not asked. Being set up counts as running.
 */
export const PROBED_STATUSES: Readonly<Record<HealthTarget, readonly TenantStatus[]>> = {
  backend: ["provisioning", "active", "restricted", "suspended"],
  storefront: ["provisioning", "active", "restricted"],
}

/** Whether a shop in `status` has its `target` probed. */
export const isProbed = (status: string, target: HealthTarget): boolean =>
  (PROBED_STATUSES[target] as readonly string[]).includes(status)
const PAGE = 200

/**
 * One probe (Ek C13): `GET url`, no redirect followed (a 3xx is a
 * failure), at most `timeoutMs`, the answer's body never read. The time is
 * to the answer's headers. Nothing is thrown.
 */
export async function probeUrl(
  url: string,
  target: HealthTarget,
  options: { fetch?: Fetch; timeoutMs?: number } = {}
): Promise<ProbeResult> {
  const started = performance.now()
  let response: Response
  try {
    response = await (options.fetch ?? fetch)(url, {
      method: "GET",
      redirect: "manual",
      headers: { accept: "*/*", "user-agent": "qticaret-control-plane-health" },
      signal: AbortSignal.timeout(options.timeoutMs ?? PROBE_TIMEOUT_MS),
    })
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name
    return {
      target,
      ok: false,
      status_code: null,
      latency_ms: null,
      error:
        name === "TimeoutError" || name === "AbortError" ? "health.timeout" : "health.unreachable",
    }
  }
  const latency = Math.max(0, Math.round(performance.now() - started))
  await response.body?.cancel().catch(() => undefined)
  return {
    target,
    ...statusOutcome(response.status),
    status_code: response.status,
    latency_ms: latency,
  }
}

/** A target that may not be asked for: a failure, without a request. */
const refused = (target: HealthTarget, code: string): ProbeResult => ({
  target,
  ok: false,
  status_code: null,
  latency_ms: null,
  error: `health.${code}`,
})

interface Job {
  tenant: TenantRecord
  target: HealthTarget
}

async function probeJob(
  container: Container,
  job: Job,
  options: { fetch?: Fetch; policy: PushPolicy; pin?: PinPolicy; timeoutMs?: number }
): Promise<ProbeResult> {
  if (job.target === "backend") {
    const base = job.tenant.api_base_url ?? ""
    const problem = pushTargetProblem(base, options.policy)
    return problem
      ? refused("backend", problem)
      : await probeUrl(new URL("/health", base).toString(), "backend", options)
  }
  const base = job.tenant.storefront_url ?? ""
  const domains = await tenantsIn(container).domainsOf(job.tenant.id)
  const verified = domains
    .filter((domain) => isVerifiedDomain(domain.verification))
    .map((domain) => domain.hostname)
  const sites = storefrontPolicy(verified)
  const problem = storefrontTargetProblem(base, sites)
  // A public name: resolved once, checked, connected to that address (review L2)
  return problem
    ? refused("storefront", problem)
    : await probePinned(
        base,
        "storefront",
        options.pin ?? pinPolicy(sites.local),
        options.timeoutMs
      )
}

export interface ProbeRun {
  probed: number
  healthy: number
  failing: number
  unhealthy: number
}

/** The shops to probe, page by page: running or being set up, with an address to ask (`PROBED_STATUSES`). */
async function probedShops(container: Container, slugs?: readonly string[]): Promise<Job[]> {
  const jobs: Job[] = []
  for (let skip = 0; ; skip += PAGE) {
    const rows = (await tenantsIn(container).listTenants(
      {
        status: [...PROBED_STATUSES.backend],
        ...(slugs ? { slug: [...slugs] } : {}),
        $or: [{ api_base_url: { $ne: null } }, { storefront_url: { $ne: null } }],
      },
      { order: { created_at: "ASC", id: "ASC" }, skip, take: PAGE }
    )) as unknown as TenantRecord[]
    for (const tenant of rows) {
      if (tenant.api_base_url && isProbed(tenant.status, "backend")) {
        jobs.push({ tenant, target: "backend" })
      }
      if (tenant.storefront_url && isProbed(tenant.status, "storefront")) {
        jobs.push({ tenant, target: "storefront" })
      }
    }
    if (rows.length < PAGE) {
      return jobs
    }
  }
}

/**
 * The health probe (adr/0061 §5.4, Ek C13): every running or provisioning
 * shop's backend `/health` (its internal address, held to the push policy)
 * and, when known, its storefront home page (held to the storefront
 * policy; not while suspended, Ek C19 L2), `PROBE_CONCURRENCY` at a time. Each result is stored with the
 * target's new standing; a change to or from `unhealthy` is logged by
 * code. `slugs` narrows it to some shops (the CLI).
 */
export async function probeFleet(
  container: Container,
  options: {
    fetch?: Fetch
    now?: () => Date
    policy?: PushPolicy
    /** The storefront probe's address rule (tests); else this environment's. */
    pin?: PinPolicy
    slugs?: readonly string[]
    timeoutMs?: number
  } = {}
): Promise<ProbeRun> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const policy = options.policy ?? pushPolicy()
  const jobs = await probedShops(container, options.slugs)
  const run: ProbeRun = { probed: 0, healthy: 0, failing: 0, unhealthy: 0 }
  await eachBounded(jobs, PROBE_CONCURRENCY, async (job) => {
    const result = await probeJob(container, job, { ...options, policy })
    const now = options.now?.() ?? new Date()
    const { from, to } = await fleetIn(container).noteProbe(job.tenant.id, result, now)
    run.probed += 1
    run[to] += 1
    if (to === "unhealthy" && from !== "unhealthy") {
      logger.warn(
        `cp.shop_unhealthy ${JSON.stringify({ tenant_id: job.tenant.id, target: job.target, error: result.error })}`
      )
    } else if (to === "healthy" && from === "unhealthy") {
      logger.info(
        `cp.shop_recovered ${JSON.stringify({ tenant_id: job.tenant.id, target: job.target })}`
      )
    }
  })
  return run
}
