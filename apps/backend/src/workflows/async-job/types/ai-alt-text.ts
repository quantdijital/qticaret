import { MedusaError } from "@medusajs/framework/utils"
import { AiAltTextInput, bulkAltText } from "../../ai/bulk-alt-text"
import type { JobType } from "./types"

/**
 * Alt text suggestions for up to 50 images (adr/0071 §8, docs/22
 * "Aşama 5"): only those with no alt text are asked for, each as its own
 * suggestion waiting for a decision; no image is written. Asked as the
 * staff member who queued it, so the task's roles, the services, the
 * quota and the day's ceiling hold as for a single ask. One at a time: a
 * second would only spend the same ceiling.
 */
export const aiAltText: JobType<AiAltTextInput> = {
  input: AiAltTextInput,
  singleton: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, job, progress }, input) => {
    if (!job.requested_by) {
      // Never queued by the platform: a suggestion is always some staff member's ask
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "staff.forbidden")
    }
    const summary = await bulkAltText(
      container,
      { ...input, user_id: job.requested_by },
      (percent) => progress(percent)
    )
    return { summary: { ...summary } }
  },
}
