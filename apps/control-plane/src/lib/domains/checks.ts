import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { codeSummary } from "@qticaret/server-kit"
import { checkDomainWorkflow } from "../../workflows/tenants/domain-check"
import { tenantsIn } from "../../workflows/modules"
import { eachBounded } from "../fleet/bounded"
import { reissuePlanDocuments } from "../fleet/reissue"
import type { DomainRecord } from "../../modules/tenants/types"

/** One run at a time: a run still asking DNS makes the next one skip. */
export const DOMAIN_CHECKS_LOCK = "cp-domain-checks"

// A run's share: more wait for the next run (their time has come; they keep it)
const PER_RUN = 50
const CONCURRENCY = 4

export interface DomainCheckRun {
  checked: number
  proved: number
  failed: number
}

/**
 * The custom domains whose check is due (F16.7): pending ones on their
 * backoff, proved ones once a day; failed ones wait for a staff member's
 * "Doğrula". Each is checked by DNS only; a shop whose verified hosts
 * changed gets its plan document issued again (and pushed).
 */
export async function checkDueDomains(
  container: MedusaContainer,
  now: Date = new Date()
): Promise<DomainCheckRun> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const due = (await tenantsIn(container).listTenantDomains(
    {
      kind: "custom",
      verification: ["pending", "verified", "active"],
      next_check_at: { $lte: now },
    },
    { select: ["id", "tenant_id"], order: { next_check_at: "ASC" }, take: PER_RUN }
  )) as unknown as Pick<DomainRecord, "id" | "tenant_id">[]
  const run: DomainCheckRun = { checked: 0, proved: 0, failed: 0 }
  const changed = new Set<string>()
  await eachBounded(due, CONCURRENCY, async (domain) => {
    try {
      const { result } = await checkDomainWorkflow(container).run({
        input: { tenant_id: domain.tenant_id, domain_id: domain.id },
      })
      run.checked += 1
      if (result.to === "failed" && result.from !== "failed") {
        run.failed += 1
      }
      if (result.proof_changed) {
        run.proved += 1
        changed.add(domain.tenant_id)
      }
    } catch (error) {
      logger.warn(
        `cp.domain_check_failed ${JSON.stringify({ domain_id: domain.id, err: codeSummary(error) })}`
      )
    }
  })
  if (changed.size > 0) {
    await reissuePlanDocuments(container, [...changed])
  }
  return run
}
