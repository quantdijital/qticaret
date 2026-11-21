import type { JSONContent } from "@tiptap/react"

/**
 * A bulk message's words (adr/0074 §5 madde 6), as the backend answers
 * them: an e-mail's subject lines, preview line and short body as one
 * JSON text (`campaign_email`), each text gated there; a text's
 * candidates one by one (`campaign_sms`), offered by the suggestion box
 * itself. Read again here: anything of another shape is never shown.
 * Nothing is saved: the editor takes what is picked as an unsaved change.
 */

export interface AiCampaignEmail {
  subjects: string[]
  preheader: string | null
  paragraphs: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const lines = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((each): each is string => typeof each === "string" && each.trim() !== "")
    : []

/** An e-mail suggestion's parts from its text; null when it holds none of ours. */
export function readCampaignEmail(text: string): AiCampaignEmail | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(value)) {
    return null
  }
  const subjects = lines(value["subjects"])
  const paragraphs = lines(value["paragraphs"])
  if (subjects.length === 0 || paragraphs.length === 0) {
    return null
  }
  const preheader = value["preheader"]
  return {
    subjects,
    preheader: typeof preheader === "string" && preheader.trim() !== "" ? preheader : null,
    paragraphs,
  }
}

// What a new body keeps of the old one: the pictures and cards, which the words do not replace
const KEPT = new Set(["image", "productCard", "categoryCard"])

/**
 * The body with the draft's words: its paragraphs (plain text nodes, never
 * HTML), then the pictures and cards the old body had, in their order.
 */
export function withDraftBody(
  doc: JSONContent | null | undefined,
  paragraphs: string[]
): JSONContent {
  const kept = (doc?.content ?? []).filter((node) => KEPT.has(node.type ?? ""))
  return {
    type: "doc",
    content: [
      ...paragraphs.map((text): JSONContent => ({
        type: "paragraph",
        content: [{ type: "text", text }],
      })),
      ...kept,
    ],
  }
}
