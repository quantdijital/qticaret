import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { codeSummary } from "@qticaret/server-kit"
import type { LedgerMismatch } from "../../modules/ai-credits/service"
import { aiCreditsIn } from "../../workflows/modules"
import { AI_STALE_OPERATION_MINUTES, AI_STALE_RELEASE_BATCH } from "./settings"
import { release } from "./spend"

type Container = Pick<MedusaContainer, "resolve">

export interface AiCreditReconcile {
  /** Shops whose ledger does not add up to their wallet; reported, never corrected. */
  mismatches: LedgerMismatch[]
  /** Operations left open past their time, released in the shop's favour. */
  released: number
  /** Those whose release failed (logged; the next run tries again). */
  failed: number
}

/**
 * The credits' watch (adr/0085 §1): every shop's ledger, bucket by bucket,
 * against its wallet. A difference is a fault to look into, never mended
 * here: it is logged (`cp.ai_credit_mismatch`, numbers only) and
 * returned. Then operations still open `AI_STALE_OPERATION_MINUTES` after
 * they began (a gateway that stopped between charge and answer) are
 * released: the shop gets its credits back.
 */
export async function reconcileAiCredits(
  container: Container,
  now: Date
): Promise<AiCreditReconcile> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const credits = aiCreditsIn(container)
  const mismatches = await credits.ledgerMismatches()
  for (const mismatch of mismatches) {
    logger.warn(`cp.ai_credit_mismatch ${JSON.stringify(mismatch)}`)
  }
  const before = new Date(now.getTime() - AI_STALE_OPERATION_MINUTES * 60 * 1000)
  let released = 0
  let failed = 0
  for (const stale of await credits.staleOperations(before, AI_STALE_RELEASE_BATCH)) {
    try {
      const done = await release(container, {
        tenantId: stale.tenant_id,
        operationId: stale.operation_id,
        now,
      })
      released += done.released ? 1 : 0
    } catch (error) {
      failed += 1
      logger.error(
        `cp.ai_credit_release_failed ${JSON.stringify({ tenant_id: stale.tenant_id, err: codeSummary(error) })}`
      )
    }
  }
  return { mismatches, released, failed }
}
