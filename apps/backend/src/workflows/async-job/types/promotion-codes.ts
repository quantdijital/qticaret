import { z } from "@medusajs/framework/zod"
import { MAX_CODES_PER_BATCH } from "../../../lib/promotions"
import { toCsv } from "../../../lib/security"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { createCodeBatchWorkflow } from "../../promotions/code-batch-workflow"
import { removeCodeBatchOf } from "../../promotions/code-batches"
import type { JobType } from "./types"

export const PromotionCodesInput = z
  .object({
    promotion_id: z.string().min(1),
    count: z.number().int().min(1).max(MAX_CODES_PER_BATCH),
  })
  .strict()
export type PromotionCodesInput = z.infer<typeof PromotionCodesInput>

/**
 * A batch of single-use codes from a promotion (F4.6, ADR-0024): up to
 * 10,000 copies of it, each usable once, in a campaign of their own. The
 * result is the codes as a CSV, one per line; the batch is in the audit
 * log with its template and size.
 */
export const promotionCodes: JobType<PromotionCodesInput> = {
  input: PromotionCodesInput,
  singleton: true,
  resultTtlDays: 30,
  containsPersonalData: false,
  execute: async ({ container, job, resultFile }, input) => {
    const { result: batch } = await createCodeBatchWorkflow(container).run({
      input: { ...input, job_id: job.id },
    })
    try {
      const file = await resultFile(`tek-kullanimlik-kodlar-${job.id}.csv`, "text/csv")
      await file.write(toCsv([["kod"], ...batch.codes.map((code) => [code])]))
      await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
        actor_type: job.requested_by ? "user" : "system",
        actor_id: job.requested_by,
        kind: "system",
        action: "promotions.codes_created",
        resource_type: "promotion",
        resource_id: input.promotion_id,
        changes: { job_id: job.id, campaign_id: batch.campaign_id, count: batch.codes.length },
      })
    } catch (error) {
      // Codes the shop has no file or record of are taken back: a retry makes them again
      await removeCodeBatchOf(container, batch.campaign_id)
      throw error
    }
    return { summary: { created: batch.codes.length, campaign_id: batch.campaign_id } }
  },
}
