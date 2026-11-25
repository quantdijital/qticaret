import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"

/**
 * What one gateway call may carry and ask for (adr/0085 §2, "Sınırlar"):
 * the gateway holds these, never the shop. The output budgets are the
 * shop's own today (`maxTokensOf` in apps/backend lib/ai/run-text.ts: a
 * task's `maxTokens`, else its longest answer twice over for each
 * candidate); a parity test loads the shop's registry and holds every
 * task to them, so a larger budget asked for is cut to this one and a
 * smaller one is kept. The pictures are the shop's: one a vision call,
 * one an edit, none for plain text.
 */

/** Everything one call's body may be, whatever its task (the route's body limit). */
export const AI_GATEWAY_MAX_BODY_BYTES = 6 * 1024 * 1024

export interface AiTaskLimits {
  /** The output budget written into a chat body; null for a picture edited (no tokens). */
  maxOutputTokens: number | null
  /** The pictures one call may send when it runs as `vision` (or edits one). */
  maxImages: number
}

const text = (maxOutputTokens: number): AiTaskLimits => ({ maxOutputTokens, maxImages: 0 })
const seeing = (maxOutputTokens: number): AiTaskLimits => ({ maxOutputTokens, maxImages: 1 })

export const AI_TASK_LIMITS: Readonly<Record<AiCreditTask, AiTaskLimits>> = Object.freeze({
  seo_title: text(360),
  seo_description: text(930),
  focus_keyword: text(360),
  product_title: text(720),
  short_description: text(9_000),
  product_tags: text(4_000),
  product_category: text(4_000),
  // A `photo` task: it may run as vision with the product's picture
  product_attributes: seeing(8_000),
  category_description: text(8_000),
  collection_description: text(8_000),
  brand_description: text(8_000),
  review_reply: text(2_000),
  question_answer: text(2_000),
  campaign_sms: text(930),
  product_description: text(10_000),
  product_faq: text(8_000),
  review_summary: text(2_400),
  campaign_email: text(6_400),
  post_draft: text(8_000),
  image_alt_text: seeing(250),
  product_from_photo: seeing(8_000),
  // apps/backend lib/ai/registry/assistant-tasks.ts `maxTokens`
  assistant: text(1_000),
  image_background: { maxOutputTokens: null, maxImages: 1 },
  image_scene: { maxOutputTokens: null, maxImages: 1 },
})

/**
 * The largest body a call may send, by what it runs as: a text call's
 * data block and instructions (the assistant's turn carries its tool
 * definitions and the turn's history: twice that), a picture's call the
 * whole 6 MB (one picture, base64 in JSON or a file in a form).
 */
export const AI_TEXT_MAX_BODY_BYTES = 256 * 1024
export const AI_ASSISTANT_MAX_BODY_BYTES = 512 * 1024

export function maxBodyBytesOf(task: AiCreditTask, capability: AiCreditCapability): number {
  if (capability !== "text") {
    return AI_GATEWAY_MAX_BODY_BYTES
  }
  return task === "assistant" ? AI_ASSISTANT_MAX_BODY_BYTES : AI_TEXT_MAX_BODY_BYTES
}

/** The pictures a call may send: none as plain text, the task's own otherwise. */
export const maxImagesOf = (task: AiCreditTask, capability: AiCreditCapability): number =>
  capability === "text" ? 0 : AI_TASK_LIMITS[task].maxImages

/**
 * How long the provider has (adr/0085 §2): text and pictures read 60 s,
 * a picture edited 120 s (the shop's own timeouts). Past it the call is
 * abandoned and its credits stay taken: the provider may have done (and
 * billed) the work.
 */
export const AI_PROVIDER_TIMEOUT_MS: Readonly<Record<AiCreditCapability, number>> = Object.freeze({
  text: 60_000,
  vision: 60_000,
  image_edit: 120_000,
})

/**
 * The largest answer read, by capability: the shop's own caps (a chat
 * answer 2 MB; an edited picture 40 MB, Photoroom's PNG, Gemini's 30 MB
 * base64). Larger is cut off: the call fails and its credits stay taken.
 */
export const AI_PROVIDER_MAX_ANSWER_BYTES: Readonly<Record<AiCreditCapability, number>> =
  Object.freeze({
    text: 2 * 1024 * 1024,
    vision: 2 * 1024 * 1024,
    image_edit: 40 * 1024 * 1024,
  })
