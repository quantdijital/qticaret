import type { JSONContent } from "@tiptap/react"
import type { FaqHeading, FaqItem, FaqQuestion } from "@/features/storefront/api/layout"

/**
 * An FAQ's rows as the form edits them (adr/0073 Ek 2026-11-24 (2)): a
 * question with its answer, or a group's heading. An answer saved before
 * rich answers (plain `answer`) is shown as one paragraph and written as
 * a rich answer (`body`) once the shop edits it.
 */

export const isFaqHeadingRow = (item: FaqItem): item is FaqHeading => "heading" in item

const emptyAnswer = (): JSONContent => ({ type: "doc", content: [] })

// "Sık sorulan sorular", "Sıkça Sorulan Sorular", "SSS", "FAQ" in any case
const FAQ_TITLE = /(s[ıi]k(ça|ca)? sorulan sorular|(^|\s)(sss|faq)(\s|$))/iu

/** Whether a new page's title names a questions page: it starts with a question to write. */
export const isFaqTitle = (title: string): boolean =>
  FAQ_TITLE.test(title.toLocaleLowerCase("tr-TR"))

/** A new question: nothing written yet. */
export const newQuestion = (): FaqQuestion => ({ question: "", body: emptyAnswer() })

/** A new group heading: nothing written yet. */
export const newHeading = (): FaqHeading => ({ heading: "" })

/** The answer as the editor shows it: the rich one, else the plain one as a paragraph. */
export function answerDoc(item: FaqQuestion): JSONContent {
  if (item.body) {
    return item.body
  }
  const text = item.answer ?? ""
  return text === ""
    ? emptyAnswer()
    : { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }
}

/** The question with a rich answer, the plain one from before dropped. */
export const withAnswer = (item: FaqQuestion, body: JSONContent): FaqQuestion => ({
  question: item.question,
  body,
})

/** Each row's number among its own kind: the questions 1, 2, 3…, the headings apart. */
export function rowNumbers(items: readonly FaqItem[]): number[] {
  const seen = { question: 0, heading: 0 }
  return items.map((item) => {
    const kind = isFaqHeadingRow(item) ? "heading" : "question"
    seen[kind] += 1
    return seen[kind]
  })
}

/** Where a dragged row would land: before or after the row under the pointer. */
export type DropPlace = "before" | "after"

/** Where a row dragged from `from` lands dropped before or after `at`; null: it would not move. */
export function dropTo(from: number, at: number, place: DropPlace): number | null {
  if (from === at) {
    return null
  }
  const to = (place === "before" ? at : at + 1) - (from < at ? 1 : 0)
  return to === from ? null : to
}

/** The list with the row at `from` moved to `to`. */
export function movedRow(items: readonly FaqItem[], from: number, to: number): FaqItem[] {
  const next = [...items]
  const [row] = next.splice(from, 1)
  if (row !== undefined) {
    next.splice(to, 0, row)
  }
  return next
}

/** The list with a copy of the row at `index` right after it. */
export function duplicatedRow(items: readonly FaqItem[], index: number): FaqItem[] {
  const row = items[index]
  if (row === undefined) {
    return [...items]
  }
  const copy: FaqItem = structuredClone(row)
  return [...items.slice(0, index + 1), copy, ...items.slice(index + 1)]
}
