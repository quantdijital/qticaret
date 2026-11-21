import { z } from "@medusajs/framework/zod"
import { MONTH_PATTERN } from "../../../modules/ai/usage-summary"
import { AI_ENTITY_TYPES } from "../../../lib/ai/facts"
import { IMAGE_BACKGROUNDS } from "../../../lib/ai/registry/services"
import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_MAX_ITEMS,
  FAQ_QUESTION_MAX_LENGTH,
  IMAGE_BACKGROUND_MAX_BATCH,
  IMAGE_SCENE_MAX_BATCH,
} from "../../../lib/ai/registry/tasks"
import { SCENE_CODE } from "@qticaret/sector-packs"
import { MEDIA_ID } from "../../../workflows/async-job/types/ai-image-edit"
import { SCENE_TEXT_MAX, cleanSceneText } from "../../../lib/ai/scene-text"
import {
  AI_GUIDANCE_DEFAULTS,
  aiGuidanceSection,
} from "../../../modules/platform-settings/sections/ai-guidance"
import type { AiGuidanceSettings } from "../../../modules/platform-settings/sections/ai-guidance"

// A record's id of a kind a suggestion is asked for; its prefix is matched to the type in the workflow
const ENTITY_ID = /^(prod|pcat|pcol|brand|cnt|media|prev|pq)_[A-Za-z0-9]{1,40}$/

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

/**
 * A picture set in one of the shop's scenes (Aşama 7): one picture, the
 * scene by its code or a saved scene's id (checked against the shop's
 * own in the workflow); its description is read on the server.
 */
const SceneSuggestion = z
  .object({
    task: z.literal("image_scene"),
    entity_type: z.literal("media"),
    entity_ids: z.array(z.string().regex(MEDIA_ID)).min(1).max(IMAGE_SCENE_MAX_BATCH),
    service: z.string().regex(NAME).optional(),
    option: z.string().regex(SCENE_CODE),
  })
  .strict()

/**
 * A picture set in a scene typed for this once (Aşama 7): the words are
 * client data, held in the workflow (`cleanSceneText`: one line, at most
 * 200 characters, no link, no markup, personal data taken out) and sent
 * behind the server's fixed words. Never a price or a credit.
 */
const CustomSceneSuggestion = z
  .object({
    task: z.literal("image_scene"),
    entity_type: z.literal("media"),
    entity_ids: z.array(z.string().regex(MEDIA_ID)).min(1).max(IMAGE_SCENE_MAX_BATCH),
    service: z.string().regex(NAME).optional(),
    prompt: z
      .string()
      .min(1)
      .max(SCENE_TEXT_MAX * 4),
  })
  .strict()

/**
 * A new product's card from one uploaded photo (Aşama 6): the picture by
 * its media record, and the template whose attributes it may fill (read
 * on the server). No category, attribute or text is taken from the client.
 */
const PhotoCardSuggestion = z
  .object({
    task: z.literal("product_from_photo"),
    entity_type: z.literal("media"),
    entity_id: z.string().regex(MEDIA_ID),
    template_id: z
      .string()
      .regex(/^atpl_[A-Za-z0-9]{1,40}$/)
      .optional(),
    service: z.string().regex(NAME).optional(),
  })
  .strict()

/**
 * A typed scene is cleaned here, before anything runs or is stored
 * (`cleanSceneText`); one that does not pass is 400 `ai.scene_text_invalid`.
 * The workflow cleans it again.
 */
export const AdminPostAiSuggestion = z
  .union([
    TextSuggestion,
    SceneSuggestion,
    CustomSceneSuggestion,
    MediaSuggestion,
    PhotoCardSuggestion,
  ])
  .transform((body, ctx) => {
    if (!("prompt" in body)) {
      return body
    }
    const prompt = cleanSceneText(body.prompt)
    if (prompt === null) {
      ctx.addIssue({ code: "custom", message: "ai.scene_text_invalid", input: body.prompt })
      return z.NEVER
    }
    return { ...body, prompt }
  })
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

/**
 * A suggestion accepted (adr/0074 §4): the candidate taken by its place
 * among those offered, the first when left out. Never a text: the server
 * returns the candidate's own.
 */
export const AdminPostAiAccept = z
  .object({
    candidate_index: z.number().int().min(0).max(9).optional(),
  })
  .strict()
export type AdminPostAiAcceptType = z.infer<typeof AdminPostAiAccept>

/**
 * "Seçilenleri ekle" under a product's FAQ draft (adr/0074 §5 madde 4): the
 * items a person kept, as they edited them, one to five. Only bounded here;
 * each is gated again in the workflow (`keptFaqItems`) as an answer's item
 * was, and refused with `ai.faq_item_invalid` when it does not pass.
 */
export const AdminPostAiFaq = z
  .object({
    items: z
      .array(
        z
          .object({
            q: z.string().max(FAQ_QUESTION_MAX_LENGTH * 4),
            a: z.string().max(FAQ_ANSWER_MAX_LENGTH * 4),
          })
          .strict()
      )
      .min(1)
      .max(FAQ_MAX_ITEMS),
  })
  .strict()
export type AdminPostAiFaqType = z.infer<typeof AdminPostAiFaq>

/** The tasks the guidance page's "Dene" compares (adr/0074 §2): a product's prose. */
export const GUIDANCE_PREVIEW_TASKS = [
  "seo_title",
  "seo_description",
  "product_description",
] as const

/**
 * "Dene" on Settings › Yapay zekâ › Yazım yönergesi (adr/0074 §2): one
 * product, one task and the guidance as the form holds it, not saved.
 * The guidance goes through the `ai_guidance` section's own schema
 * (markup, invisible characters and personal data taken out, lengths and
 * task ids held), exactly as a save would; fields left out are the
 * defaults. The product's text is read on the server.
 */
export const AdminPostAiGuidancePreview = z
  .object({
    task: z.enum(GUIDANCE_PREVIEW_TASKS),
    product_id: z.string().regex(/^prod_[A-Za-z0-9]{1,40}$/),
    service: z.string().regex(NAME).optional(),
    guidance: aiGuidanceSection.patch,
  })
  .strict()
  .transform((body) => ({
    ...body,
    guidance: { ...AI_GUIDANCE_DEFAULTS, ...body.guidance } as AiGuidanceSettings,
  }))
export type AdminPostAiGuidancePreviewType = z.infer<typeof AdminPostAiGuidancePreview>

/** A month's usage (`YYYY-MM`, Turkey); this month when left out. */
export const AdminGetAiUsage = z.object({
  month: z.string().regex(MONTH_PATTERN).optional(),
})
export type AdminGetAiUsageType = z.infer<typeof AdminGetAiUsage>
