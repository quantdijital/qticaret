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
  "product_description",
  "review_reply",
  "question_answer",
  "review_summary",
] as const
export type GuidanceTask = (typeof GUIDANCE_TASKS)[number]

export interface AiTaskGuidance {
  extra: string | null
  examples: string[]
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
