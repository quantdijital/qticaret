import { MedusaError } from "@medusajs/framework/utils"
import { IMAGE_ALT_TEXT_TASK } from "../../../lib/ai/registry/tasks"
import { AiAltTextInput, bulkAltText } from "../../ai/bulk-alt-text"
import { pickServiceFor } from "../../ai/steps/select-service"
import type { JobType } from "./types"

/**
 * Alt text suggestions for up to 50 images (adr/0071 §8, docs/22
 * "Aşama 5"): only those with no alt text are asked for, each as its own
 * suggestion waiting for a decision; no image is written. Asked as the
 * staff member who queued it, so the task's roles, the services, the
 * quota and the day's ceiling hold as for a single ask. One at a time: a
 * second would only spend the same ceiling. The service is chosen as it
 * is queued, as for any ask (nothing usable refuses the job), and the way
 * it is paid is kept: an image never moves to the platform's credits or
 * back by itself while the job runs (`prepare`).
 */
export const aiAltText: JobType<AiAltTextInput> = {
  input: AiAltTextInput,
  singleton: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  prepare: async (container, input, requestedBy) => {
    // The way of paying is the server's choice, never the request's
    const asked: AiAltTextInput = {
      media_ids: input.media_ids,
      ...(input.service === undefined ? {} : { service: input.service }),
    }
    if (!requestedBy) {
      return asked
    }
    const { service } = await pickServiceFor(container, {
      task: IMAGE_ALT_TEXT_TASK.id,
      user_id: requestedBy,
      service: asked.service,
    })
    return { ...asked, funding: service.funding }
  },
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
