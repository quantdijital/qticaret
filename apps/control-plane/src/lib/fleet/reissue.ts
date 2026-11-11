import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { issuePlanDocumentWorkflow } from "../../workflows/fleet/plan-document"
import type { IssuedPlanDocument } from "../../workflows/fleet/plan-document"
import { fleetIn, plansIn, tenantsIn, vaultIn } from "../../workflows/modules"
import { eachBounded } from "./bounded"
import { pushPlanDocument } from "./push"

type Container = MedusaContainer

const CONCURRENCY = 4
// Shops on one package issued inside the staff request; more go to a background run
const INLINE_LIMIT = 20

const logOf = (container: Container) => container.resolve(ContainerRegistrationKeys.LOGGER)

/**
 * After a change to what shops may do (a package, its limits or flags, a
 * shop's package or exceptions; later its status and billing), each
 * affected shop's document is issued again when its content changed
 * (Ek C9), then pushed without waiting. Neither ever fails the staff
 * action that caused it: an issue that fails is logged and the reconcile
 * job issues it later; a push that fails is retried by the push job, and
 * the shop's pull covers both.
 */
export async function reissuePlanDocuments(
  container: Container,
  tenantIds: readonly string[],
  options: { push?: boolean } = {}
): Promise<Map<string, IssuedPlanDocument>> {
  const results = new Map<string, IssuedPlanDocument>()
  await eachBounded([...new Set(tenantIds)], CONCURRENCY, async (tenantId) => {
    try {
      const { result } = await issuePlanDocumentWorkflow(container).run({
        input: { tenant_id: tenantId },
      })
      results.set(tenantId, result)
    } catch (error) {
      logOf(container).error(
        `cp.plan_issue_failed ${JSON.stringify({ tenant_id: tenantId, err: errorSummary(error) })}`
      )
    }
  })
  const issued = [...results].filter(([, result]) => result.issued).map(([id]) => id)
  if (options.push !== false && issued.length > 0) {
    // One background run, a few at a time; the push job retries what fails
    void eachBounded(issued, CONCURRENCY, (tenantId) => pushLatest(container, tenantId))
  }
  return results
}

/**
 * A package's shops after a change to it (review L7): up to `INLINE_LIMIT`
 * in the request, a few at a time; more are left to a background run of
 * the same, and the reconcile job (every 10 minutes) covers that run if
 * the process stops.
 */
export async function reissueForPackage(container: Container, packageId: string): Promise<void> {
  const tenants = await tenantsOnPackage(container, packageId)
  if (tenants.length <= INLINE_LIMIT) {
    await reissuePlanDocuments(container, tenants)
    return
  }
  logOf(container).info(
    `cp.plan_reissue_background ${JSON.stringify({ package_id: packageId, shops: tenants.length })}`
  )
  void reissuePlanDocuments(container, tenants)
}

/** The shop's latest document pushed now, if it still waits for a push. */
async function pushLatest(container: Container, tenantId: string): Promise<void> {
  try {
    const latest = await fleetIn(container).latestPlanDocument(tenantId)
    if (latest?.push_status === "pending") {
      await pushPlanDocument(container, latest)
    }
  } catch (error) {
    logOf(container).warn(
      `cp.plan_push_failed ${JSON.stringify({ tenant_id: tenantId, err: errorSummary(error) })}`
    )
  }
}

/** The shops on a package (a change to it reaches each of them). */
export async function tenantsOnPackage(container: Container, packageId: string) {
  return [...(await plansIn(container).plansOf({ package_id: packageId })).keys()]
}

/**
 * Every shop's document brought up to date (the reconcile job): an
 * exception that expired, a change whose issue failed. Only shops with a
 * package have one. The count of documents issued.
 */
export async function reconcilePlanDocuments(container: Container): Promise<number> {
  // No signing key yet (a fresh machine before `cp:keys signing-init`): nothing can
  // be issued, said once a run rather than once a shop
  if (!(await vaultIn(container).signingKeyIn("active"))) {
    logOf(container).warn('cp.plan_reconcile_skipped {"reason":"no_signing_key"}')
    return 0
  }
  const plans = await plansIn(container).plansOf({})
  if (plans.size === 0) {
    return 0
  }
  // A plan row whose shop record is gone issues nothing
  const known = new Set(
    (
      await tenantsIn(container).listTenants(
        { id: [...plans.keys()] },
        { select: ["id"], take: plans.size }
      )
    ).map((tenant) => tenant.id)
  )
  const results = await reissuePlanDocuments(
    container,
    [...plans.keys()].filter((id) => known.has(id))
  )
  return [...results.values()].filter((result) => result.issued).length
}
