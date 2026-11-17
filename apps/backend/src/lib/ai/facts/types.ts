import type { MedusaContainer } from "@medusajs/framework/types"
import type { PromptValue } from "../prompt"

export type FactsContainer = Pick<MedusaContainer, "resolve">

/** A record's fields as the data block takes them, before the personal data filter (lib/ai/prompt.ts). */
export type RecordFacts = Record<string, PromptValue>
