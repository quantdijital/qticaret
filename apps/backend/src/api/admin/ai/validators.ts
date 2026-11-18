import { z } from "@medusajs/framework/zod"
import { MONTH_PATTERN } from "../../../modules/ai/usage-summary"
import { AI_ENTITY_TYPES } from "../../../lib/ai/facts"
import { IMAGE_BACKGROUNDS } from "../../../lib/ai/registry/services"
import { IMAGE_BACKGROUND_MAX_BATCH } from "../../../lib/ai/registry/tasks"
import { MEDIA_ID } from "../../../workflows/async-job/types/ai-image-edit"

// A record's id of a kind a suggestion is asked for; its prefix is matched to the type in the workflow
const ENTITY_ID = /^(prod|pcat|cnt|media|prev|pq)_[A-Za-z0-9]{1,40}$/

// A registry name: the task, the service and the option are checked against the registry
const NAME = /^[a-z][a-z0-9_]{0,39}$/

/**
 * A suggestion asked for (adr/0071 §11): which task on which record, and,
 * only when several services are usable, the one picked. No text, prompt
 * or price is taken from the client.
 */
const TextSuggestion = z
  .object({
    task: z.string().regex(NAME),
    entity_type: z.enum(AI_ENTITY_TYPES),
    entity_id: z.string().regex(ENTITY_ID),
    service: z.string().regex(NAME).optional(),
    option: z.string().regex(NAME).optional(),
  })
  .strict()

/**
 * Pictures of the media library (Aşama 4): a job over one to twenty of
 * them, the option the background. Ids only; the bytes are read on the server.
 */
const MediaSuggestion = z
  .object({
    task: z.string().regex(NAME),
    entity_type: z.literal("media"),
    entity_ids: z.array(z.string().regex(MEDIA_ID)).min(1).max(IMAGE_BACKGROUND_MAX_BATCH),
    service: z.string().regex(NAME).optional(),
    option: z.enum(IMAGE_BACKGROUNDS),
  })
  .strict()

export const AdminPostAiSuggestion = z.union([TextSuggestion, MediaSuggestion])
export type AdminPostAiSuggestionType = z.infer<typeof AdminPostAiSuggestion>

/**
 * The open suggestions to review (docs/22 "Aşama 5"): only an image's alt
 * text has a review list so far; another task is refused.
 */
export const AdminGetAiSuggestions = z
  .object({
    task: z.enum(["image_alt_text"]),
  })
  .strict()
export type AdminGetAiSuggestionsType = z.infer<typeof AdminGetAiSuggestions>

/** A month's usage (`YYYY-MM`, Turkey); this month when left out. */
export const AdminGetAiUsage = z.object({
  month: z.string().regex(MONTH_PATTERN).optional(),
})
export type AdminGetAiUsageType = z.infer<typeof AdminGetAiUsage>
