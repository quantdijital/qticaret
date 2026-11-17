import { z } from "@medusajs/framework/zod"
import { MONTH_PATTERN } from "../../../modules/ai/usage-summary"
import { AI_ENTITY_TYPES } from "../../../workflows/ai/steps/task-input"

// A registry name: the task, the service and the option are checked against the registry
const NAME = /^[a-z][a-z0-9_]{0,39}$/

/**
 * A suggestion asked for (adr/0071 §11): which task on which record, and,
 * only when several services are usable, the one picked. No text, prompt
 * or price is taken from the client.
 */
export const AdminPostAiSuggestion = z
  .object({
    task: z.string().regex(NAME),
    entity_type: z.enum(AI_ENTITY_TYPES),
    entity_id: z.string().regex(/^prod_[A-Za-z0-9]{1,40}$/),
    service: z.string().regex(NAME).optional(),
    option: z.string().regex(NAME).optional(),
  })
  .strict()
export type AdminPostAiSuggestionType = z.infer<typeof AdminPostAiSuggestion>

/** A month's usage (`YYYY-MM`, Turkey); this month when left out. */
export const AdminGetAiUsage = z.object({
  month: z.string().regex(MONTH_PATTERN).optional(),
})
export type AdminGetAiUsageType = z.infer<typeof AdminGetAiUsage>
