import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { codeSummary } from "@qticaret/server-kit"
import type { LedgerMismatch } from "../../modules/ai-credits/service"
import type { StaleOperation } from "../../modules/ai-credits/service-closing"
import { aiCreditsIn } from "../../workflows/modules"
import {
  AI_STALE_OPERATION_MINUTES,
  AI_STALE_RELEASE_BATCH,
  AI_STALE_RELEASE_PAGES,
} from "./settings"
import { releaseStale } from "./spend"

type Container = Pick<MedusaContainer, "resolve">

export interface AiCreditReconcile {
  /** Whether this run compared ledger and wallet (hourly; the releases run every time). */
  compared: boolean
  /** Shops whose ledger does not add up to their wallet; reported, never corrected. */
  mismatches: LedgerMismatch[]
  /** Operations left open past their time that this run read. */
  scanned: number
  /** Those released in the shop's favour. */
  released: number
  /** Those whose release failed (logged and passed over; the next run tries again). */
  failed: number
}

export interface ReconcileOptions {
  /** Compare every shop's ledger with its wallet (the whole ledger: hourly). */
  compare: boolean
  /** Stale operations read at a time (tests make it small). */
  batch?: number
}

/**
 * The credits' watch (adr/0085 §1). When `compare`, every shop's ledger,
 * bucket by bucket, against its wallet: a difference is a fault to look
 * into, never mended here; it is logged (`cp.ai_credit_mismatch`, numbers
 * only) and returned. Then operations still open
 * `AI_STALE_OPERATION_MINUTES` after they began (a gateway that stopped
 * between charge and answer) are released: the shop gets its credits
 * back. They are read page after page past the last one read, so one
 * whose release fails (logged, counted) does not hold back the rest; a
 * run reads at most `AI_STALE_RELEASE_PAGES` pages, the next goes on.
 */
export async function reconcileAiCredits(
  container: Container,
  now: Date,
  options: ReconcileOptions
): Promise<AiCreditReconcile> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const credits = aiCreditsIn(container)
  const mismatches = options.compare ? await credits.ledgerMismatches() : []
  for (const mismatch of mismatches) {
    logger.warn(`cp.ai_credit_mismatch ${JSON.stringify(mismatch)}`)
  }
  const batch = options.batch ?? AI_STALE_RELEASE_BATCH
  const startedBefore = new Date(now.getTime() - AI_STALE_OPERATION_MINUTES * 60 * 1000)
  let scanned = 0
  let released = 0
  let failed = 0
  let after: StaleOperation | null = null
  for (let page = 0; page < AI_STALE_RELEASE_PAGES; page += 1) {
    const stale = await credits.staleOperations(startedBefore, batch, after)
    for (const operation of stale) {
      scanned += 1
      try {
        const done = await releaseStale(container, {
          tenantId: operation.tenant_id,
          operationId: operation.operation_id,
          startedBefore,
          now,
        })
        released += done.released ? 1 : 0
      } catch (error) {
        failed += 1
        logger.error(
          `cp.ai_credit_release_failed ${JSON.stringify({ tenant_id: operation.tenant_id, err: codeSummary(error) })}`
        )
      }
    }
    after = stale.at(-1) ?? null
    if (stale.length < batch) {
      break
    }
  }
  return { compared: options.compare, mismatches, scanned, released, failed }
}
