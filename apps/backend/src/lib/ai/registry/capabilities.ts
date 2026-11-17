/**
 * What an AI service can do (adr/0071 §2). A service lists the ones it
 * was verified for; a task names the one it needs. `embedding` and
 * `model_3d` come with their own ADRs.
 */
export const AI_CAPABILITIES = ["text", "vision", "image_edit", "image_generate", "video"] as const

export type AiCapability = (typeof AI_CAPABILITIES)[number]

export const isAiCapability = (value: unknown): value is AiCapability =>
  typeof value === "string" && (AI_CAPABILITIES as readonly string[]).includes(value)
