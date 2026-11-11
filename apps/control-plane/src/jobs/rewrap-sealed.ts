import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { kekStatus } from "../lib/vault/kek-status"
import { rewrapSealedWorkflow } from "../workflows/vault/rewrap"

/**
 * The KEK rotation's background job (adr/0061 §4.1, Ek C8): hourly, when
 * values wait under an older configured KEK, they are rewrapped. Values
 * under a KEK that is no longer configured are said loudly every hour
 * (they cannot be opened until the key is put back). Counts and
 * fingerprints only.
 */
export default async function rewrapSealedJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const before = await kekStatus(container)
    if (before.stranded > 0) {
      logger.error(
        `cp.kek_missing ${JSON.stringify({
          kek_ids: before.keks.filter((kek) => kek.state === "missing").map((kek) => kek.kek_id),
          records: before.stranded,
        })}`
      )
    }
    if (before.pending === 0) {
      return
    }
    const { result } = await rewrapSealedWorkflow(container).run()
    logger.info(
      `cp.rewrap_done ${JSON.stringify({
        rewrapped: result.secret_record.rewrapped + result.tenant_company.rewrapped,
        failed: result.secret_record.failed + result.tenant_company.failed,
      })}`
    )
  } catch (error) {
    logger.error(`cp.rewrap_job_failed ${JSON.stringify({ err: errorSummary(error) })}`)
  }
}

export const config = {
  name: "cp-sealed-rewrap",
  schedule: "17 * * * *",
}
