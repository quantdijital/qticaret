import "server-only"
import type { SearchInterpretation } from "@/lib/views/natural-search"
import { storeCall } from "./server"

/** The backend waits 8 s for the service; a little more for the way there and back. */
const TIMEOUT_MS = 10_000

/** The longest sentence the backend reads (`SEARCH_TEXT_MAX`). */
const MAX_TEXT = 200

const isAnswer = (value: unknown): value is SearchInterpretation => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const answer = value as Record<string, unknown>
  return (
    typeof answer["query"] === "string" &&
    Array.isArray(answer["understood"]) &&
    Array.isArray(answer["dropped"])
  )
}

/**
 * The shopper's sentence read into the search's filters (adr/0077 §7,
 * `POST /store/search/interpret`), asked with the shopper's own address
 * (each address is counted). Null whatever fails: the flag off (404), a
 * limit reached (429), the shop in maintenance, the service slow or an
 * answer of another form; the page then searches the words as they are.
 */
export async function interpretSentence(text: string): Promise<SearchInterpretation | null> {
  const sentence = text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT).trim()
  if (!sentence) {
    return null
  }
  try {
    const answer = await storeCall<unknown>("/store/search/interpret", {
      method: "POST",
      body: { text: sentence },
      timeoutMs: TIMEOUT_MS,
    })
    return isAnswer(answer) ? answer : null
  } catch {
    return null
  }
}
