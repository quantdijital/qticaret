import { MedusaError } from "@medusajs/framework/utils"
import { AiSeoFillInput, seoFill } from "../../ai/bulk-seo/fill"
import type { JobType } from "./types"

/**
 * Search text suggestions for up to 50 pages with an advisor finding on
 * them (adr/0074 §5 madde 7): each page's title and description asked as
 * its own suggestion, waiting for a decision; no page is written. Queued
 * only by `POST /admin/ai/seo-fill`, which checks the role and the quota
 * first and picks the pages itself, never with an input sent from outside.
 * Asked as the staff member who queued it, one at a time.
 */
export const aiSeoFill: JobType<AiSeoFillInput> = {
  input: AiSeoFillInput,
  singleton: true,
  internal: true,
  managersOnly: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, job, progress }, input) => {
    if (!job.requested_by) {
      // Never queued by the platform: a suggestion is always some staff member's ask
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "staff.forbidden")
    }
    const summary = await seoFill(container, { ...input, user_id: job.requested_by }, (percent) =>
      progress(percent)
    )
    return { summary: { ...summary } }
  },
}
