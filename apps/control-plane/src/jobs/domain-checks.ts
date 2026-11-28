import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { DOMAIN_CHECKS_LOCK, checkDueDomains } from "../lib/domains/checks"
import type { DomainCheckRun } from "../lib/domains/checks"

/**
 * Custom domains' DNS checks (F16.7): every five minutes, the ones whose
 * check is due (pending on their backoff for a week, proved ones daily).
 * Counts only in the log.
 */
export default async function domainChecksJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  let result: DomainCheckRun
  try {
    result = await container
      .resolve(Modules.LOCKING)
      .execute(DOMAIN_CHECKS_LOCK, () => checkDueDomains(container), { timeout: 1 })
  } catch (error) {
    logger.warn(`cp.domain_checks_skipped ${JSON.stringify({ err: errorSummary(error) })}`)
    return
  }
  if (result.checked > 0) {
    logger.info(`cp.domain_checks ${JSON.stringify(result)}`)
  }
}

export const config = {
  name: "cp-domain-checks",
  schedule: "*/5 * * * *",
}
