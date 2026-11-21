/**
 * A product's FAQ draft (adr/0074 §5 madde 4), as the backend answers it:
 * three to five questions with their answers, each already gated there.
 * Read again here, item by item: anything of another shape is never shown.
 * What a person keeps, edited or not, is gated once more on the server
 * before it is added (`POST /admin/ai/suggestions/:id/faq`).
 */

export interface AiFaqItem {
  question: string
  answer: string
}

export interface AiFaq {
  items: AiFaqItem[]
}

/** The server's limits for one item, in characters (`FAQ_*_MAX_LENGTH`). */
export const FAQ_LIMITS = { question: 120, answer: 400, items: 5 } as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The items of an answer, or null when it holds none of ours. */
export function readFaq(value: unknown): AiFaq | null {
  if (!isRecord(value) || !Array.isArray(value["items"])) {
    return null
  }
  const items = value["items"]
    .flatMap((each: unknown): AiFaqItem[] =>
      isRecord(each) &&
      typeof each["question"] === "string" &&
      typeof each["answer"] === "string" &&
      each["question"].trim() !== "" &&
      each["answer"].trim() !== ""
        ? [{ question: each["question"], answer: each["answer"] }]
        : []
    )
    .slice(0, FAQ_LIMITS.items)
  return { items }
}

/** An item as a person left it: what the server would refuse before it is sent, as a key. */
export function faqItemIssue(item: AiFaqItem): "empty" | "not_a_question" | "too_long" | null {
  const question = item.question.trim()
  const answer = item.answer.trim()
  if (question === "" || answer === "") {
    return "empty"
  }
  if (!question.endsWith("?")) {
    return "not_a_question"
  }
  if (
    Array.from(question).length > FAQ_LIMITS.question ||
    Array.from(answer).length > FAQ_LIMITS.answer
  ) {
    return "too_long"
  }
  return null
}
