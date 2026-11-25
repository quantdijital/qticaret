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

/**
 * The text one call may send (security review of P3b O1): the body as
 * rebuilt, less its inline pictures' base64, so a credit's price holds
 * whatever a picture call carries beside its picture. Measured against the
 * shop's own bodies: every text task's data block is at most
 * `MAX_DATA_CHARS` (30,000 UTF-16 units, apps/backend lib/ai/prompt.ts),
 * written once more as a JSON string in the body (its quotes escaped,
 * Turkish letters two bytes) beside the system message (the task's
 * instructions and the owner's own): about 40 KB at the data block's
 * limit. So a short task and a picture read take 64 KB, not the 32 KB the
 * review proposed (32 KB would refuse a full data block the shop sends);
 * the long writing tasks 128 KB; an edited picture's text is the shop's
 * fixed instruction alone (32 KB); the assistant keeps its 512 KB (its
 * tools and the turn's history).
 */
export const AI_SHORT_TEXT_MAX_BYTES = 64 * 1024
export const AI_LONG_TEXT_MAX_BYTES = 128 * 1024
export const AI_IMAGE_EDIT_TEXT_MAX_BYTES = 32 * 1024

const LONG_TEXT_TASKS: ReadonlySet<AiCreditTask> = new Set<AiCreditTask>([
  "product_description",
  "product_faq",
  "review_summary",
  "campaign_email",
  "post_draft",
])

/** The text a call may send: its body less the inline pictures' base64. */
export function maxTextBytesOf(task: AiCreditTask, capability: AiCreditCapability): number {
  if (task === "assistant") {
    return AI_ASSISTANT_MAX_BODY_BYTES
  }
  if (capability === "image_edit") {
    return AI_IMAGE_EDIT_TEXT_MAX_BYTES
  }
  return LONG_TEXT_TASKS.has(task) ? AI_LONG_TEXT_MAX_BYTES : AI_SHORT_TEXT_MAX_BYTES
}

/**
 * The types an inline picture may be (second security review of P3b, N1):
 * what the shop's connectors send today (apps/backend lib/ai/run-image.ts
 * `imageInputOf`: a JPEG, PNG or WebP as uploaded, an AVIF turned into a
 * PNG; lib/ai/image-input.ts: a vision call's JPEG). Anything else (text,
 * a PDF, an SVG) is refused, so its bytes are never taken off the text a
 * call may send as a picture's.
 */
export const AI_INLINE_IMAGE_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
])

/**
 * The most pixels a picture sent to an image service may have, read from
 * its header (image-dimensions.ts): the shop's own upload limit
 * (apps/backend lib/media/sanitize.ts `MAX_INPUT_PIXELS`), 40 MP.
 */
export const AI_INLINE_IMAGE_MAX_PIXELS = 40_000_000

/** The pictures a call may send: none as plain text, the task's own otherwise. */
export const maxImagesOf = (task: AiCreditTask, capability: AiCreditCapability): number =>
  capability === "text" ? 0 : AI_TASK_LIMITS[task].maxImages

/**
 * Calls in flight at once (security review of P3b O2, in-flight.ts): four
 * a shop (its own bulk work runs a few at a time), 32 in this process.
 */
export const AI_GATEWAY_MAX_IN_FLIGHT_PER_SHOP = 4
export const AI_GATEWAY_MAX_IN_FLIGHT = 32

/**
 * Bodies read at once, before any signature is checked (second security
 * review of P3b, N2; body-reads.ts): whoever sends them, at most 16 calls'
 * bytes (up to 6 MB each, ~96 MB) are held in this process while they
 * arrive. One more is answered 503 `unavailable` and its body never kept.
 */
export const AI_GATEWAY_MAX_BODY_READS = 16

/**
 * Bodies read at once from one client address (third security review of
 * P3b, O1): a sender alone cannot take the process's 16 slow reads. The
 * slot is held only while a body arrives, never while the provider works,
 * so shops leaving through one address still read four at a time.
 */
export const AI_GATEWAY_MAX_BODY_READS_PER_ADDRESS = 4

/**
 * The slowest a body may arrive (O1): from 2 s into the read, the bytes
 * received must keep up with 32 KB a second of the time spent (a body
 * already ended is never cut); a slower sender is answered 408 and its
 * connection closed, checked twice a second. A shop's 6 MB picture over
 * a poor uplink (1 Mbit/s, ~128 KB/s) stays well above it.
 */
export const AI_GATEWAY_BODY_MIN_BYTES_PER_SECOND = 32 * 1024
export const AI_GATEWAY_BODY_GRACE_MS = 2_000
export const AI_GATEWAY_BODY_PACE_CHECK_MS = 500

/**
 * How long a call's body may take to arrive (O2): past it the request is
 * answered 408 and its connection closed, before the signature is checked.
 */
export const AI_GATEWAY_BODY_TIMEOUT_MS = 30_000

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
