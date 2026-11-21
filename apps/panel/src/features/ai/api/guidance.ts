import { postAi } from "@/features/ai/api/suggestions"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"

/**
 * The `ai_guidance` settings section (adr/0074 §2): the shop's writing
 * guidance, put into every AI text task's instruction as the shop's own
 * part. Owner and admin write it; the server holds every text as plain
 * text and takes personal data out.
 */

export const AI_TONES = ["warm", "professional", "expert", "premium", "plain"] as const
export type AiTone = (typeof AI_TONES)[number]

export const AI_ADDRESSES = ["siz", "sen", "none"] as const
export type AiAddress = (typeof AI_ADDRESSES)[number]

/** The server's limits (`GUIDANCE_LIMITS`), in characters or items. */
export const GUIDANCE_LIMITS = {
  audience: 160,
  guide: 1_500,
  words: 20,
  word: 40,
  extra: 600,
  examples: 3,
  example: 600,
  craft: 3_000,
} as const

/**
 * The text tasks that take guidance of their own, in the order a shop
 * meets them; the server's registry decides (it refuses any other).
 */
export const GUIDANCE_TASKS = [
  "seo_title",
  "seo_description",
  "focus_keyword",
  "product_title",
  "short_description",
  "product_description",
  "category_description",
  "collection_description",
  "brand_description",
  "review_reply",
  "question_answer",
  "review_summary",
] as const
export type GuidanceTask = (typeof GUIDANCE_TASKS)[number]

export interface AiTaskGuidance {
  extra: string | null
  examples: string[]
  /**
   * The owner's own instruction in the default's place (adr/0074 §3); null
   * or left out: the default. Sent by the owner only: the server refuses it
   * from anyone else, and a save without it keeps the stored one.
   */
  craft?: string | null
  /** The default's version it was written against; the server sets it (sent only to keep one's own). */
  craft_base?: string | null
}

export interface AiGuidanceSettings {
  tone: AiTone
  address: AiAddress
  audience: string | null
  guide: string | null
  prefer: string[]
  avoid: string[]
  tasks: Partial<Record<string, AiTaskGuidance>>
}

export const aiGuidanceQuery = () => sectionQuery<AiGuidanceSettings>("ai_guidance")

export const useSaveAiGuidance = () => useSaveSection<AiGuidanceSettings>("ai_guidance")

/** A text's length in characters (code points), as the server counts it. */
export const textLength = (text: string): number => Array.from(text).length

/** Whether a text is over its limit (the save waits until it is not). */
export const overLimit = (value: string, max: number): boolean => textLength(value) > max

/** The tasks "Dene" compares (the server's `GUIDANCE_PREVIEW_TASKS`): a product's prose. */
export const PREVIEW_TASKS = ["seo_title", "seo_description", "product_description"] as const
export type PreviewTask = (typeof PREVIEW_TASKS)[number]

/** One side of the comparison: the candidates that passed the gate, or why none did. */
export interface PreviewSide {
  status: "succeeded" | "refused"
  candidates: string[]
  problems: string[]
}

export interface GuidancePreview {
  /** Without the shop's guidance. */
  plain: PreviewSide
  /** With the guidance as the form holds it. */
  guided: PreviewSide
}

const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === "string") : []

const sideOf = (value: unknown): PreviewSide => {
  const side = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>
  return {
    status: side["status"] === "succeeded" ? "succeeded" : "refused",
    candidates: texts(side["candidates"]),
    problems: texts(side["problems"]),
  }
}

/**
 * `POST /admin/ai/guidance/preview` (adr/0074 §2, "Dene"): a product's
 * suggestion for a task without and with the guidance not yet saved. Two
 * calls that count against the quota; nothing is kept or written.
 */
export async function previewGuidance(request: {
  task: PreviewTask
  productId: string
  guidance: AiGuidanceSettings
}): Promise<GuidancePreview> {
  const data = (await postAi("/admin/ai/guidance/preview", {
    task: request.task,
    product_id: request.productId,
    guidance: request.guidance,
  })) as { preview?: { plain?: unknown; guided?: unknown } } | null
  return { plain: sideOf(data?.preview?.plain), guided: sideOf(data?.preview?.guided) }
}
