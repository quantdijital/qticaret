import type { JSONContent } from "@tiptap/react"
import { FAQ_LIMITS } from "@qticaret/types"
import { docText } from "@/features/content/doc-text"
import { unknownShopTokens } from "@/features/settings/shop-tokens"
import { isFaqHeadingRow } from "./faq-rows"
import type { FaqItem } from "@/features/storefront/api/layout"
import { textProblem } from "./problems"
import type { Problem } from "./problems"

/**
 * An FAQ's rows as the server would refuse them (adr/0073 Ek 2026-11-24
 * (2)): a heading or a question left empty or too long, an answer left
 * empty, past its characters or naming a detail the shop does not have.
 */
export function faqProblems(items: readonly FaqItem[]): [string, Problem | null][] {
  return items.flatMap((item, index): [string, Problem | null][] => {
    const at = `items.${String(index)}`
    if (isFaqHeadingRow(item)) {
      return [
        [
          `${at}.heading`,
          item.heading.trim() === "" ? "required" : textProblem(item.heading, FAQ_LIMITS.heading),
        ],
      ]
    }
    return [
      [
        `${at}.question`,
        item.question.trim() === ""
          ? "questionRequired"
          : textProblem(item.question, FAQ_LIMITS.question),
      ],
      [`${at}.answer`, answerProblem(item.body, item.answer)],
    ]
  })
}

/** A rich answer by its text, else a plain one from before rich answers. */
function answerProblem(body: JSONContent | undefined, plain: string | undefined): Problem | null {
  if (body !== undefined) {
    const text = docText(body)
    if (text === "") {
      return "answerRequired"
    }
    if (text.length > FAQ_LIMITS.answerChars) {
      return "tooLong"
    }
    return unknownShopTokens(text).length > 0 ? "tokenUnknown" : null
  }
  const answer = plain ?? ""
  return answer.trim() === "" ? "answerRequired" : textProblem(answer, FAQ_LIMITS.answer, true)
}
