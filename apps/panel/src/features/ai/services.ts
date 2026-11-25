/**
 * The AI services the panel has words for (`ai.services.<id>`), as the
 * backend registry names them (`lib/ai/registry/services.ts`); `fake` is
 * the development-only one. A service the panel does not know still shows,
 * by its id.
 */
export const AI_SERVICE_IDS = [
  "deepseek",
  "minimax",
  "gemini",
  "photoroom",
  "bria",
  "fake",
] as const

/** Whether a credential provider is an AI service's account (adr/0071 §3). */
export const isAiService = (provider: string): boolean =>
  (AI_SERVICE_IDS as readonly string[]).includes(provider)
