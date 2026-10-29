import { z } from "@medusajs/framework/zod"
import { WEBHOOK_EVENTS, webhookUrlProblem } from "../../../lib/webhooks"

const url = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, ctx) => {
    const problem = webhookUrlProblem(value)
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem })
    }
  })

const events = z
  .array(z.enum(WEBHOOK_EVENTS))
  .min(1, "webhook.events_required")
  .refine((list) => new Set(list).size === list.length, { message: "webhook.events_required" })

/** A subscription: an https address outside the shop's network, and the events it takes (KK3). */
export const AdminPostWebhook = z.object({ url, events }).strict()
export type AdminPostWebhookType = z.infer<typeof AdminPostWebhook>

/** A change: a new address or events, or `active` to turn one on again after it was turned off. */
export const AdminPostWebhookUpdate = z
  .object({
    url: url.optional(),
    events: events.optional(),
    status: z.literal("active").optional(),
  })
  .strict()
export type AdminPostWebhookUpdateType = z.infer<typeof AdminPostWebhookUpdate>
