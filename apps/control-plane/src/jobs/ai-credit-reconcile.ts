import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { reconcileAiCredits } from "../lib/ai-credits/reconcile"

/**
 * The AI credits' watch (adr/0085 §1), every ten minutes: each shop's
 * ledger against its wallet (a difference is logged, never mended) and
 * operations left open past their time released. One run at a time.
 *
 * Not under NODE_ENV=test: the tests run `reconcileAiCredits` with a clock
 * of their own, and a tick on the real clock in the middle of a test file
 * would release that file's open operations, dated by its clock, beside
 * it. The job keeps no state of its own between runs.
 */
export default async function aiCreditReconcileJob(container: MedusaContainer): Promise<void> {
  if (process.env["NODE_ENV"] === "test") {
    return
  }
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const run = await container
      .resolve(Modules.LOCKING)
      .execute("cp-ai-credit-reconcile", () => reconcileAiCredits(container, new Date()), {
        timeout: 1,
      })
    if (run.mismatches.length + run.released + run.failed > 0) {
      logger.info(
        `cp.ai_credit_reconciled ${JSON.stringify({
          mismatches: run.mismatches.length,
          released: run.released,
          failed: run.failed,
        })}`
      )
    }
  } catch (error) {
    logger.error(`cp.ai_credit_reconcile_failed ${JSON.stringify({ err: errorSummary(error) })}`)
  }
}

export const config = {
  name: "cp-ai-credit-reconcile",
  schedule: "*/10 * * * *",
}
