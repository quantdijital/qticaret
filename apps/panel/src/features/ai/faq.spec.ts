import { describe, expect, it } from "vitest"
import { faqItemIssue, readFaq } from "./faq"

describe("readFaq", () => {
  it("keeps items of our shape, five at most", () => {
    const item = { question: "Rengi nedir?", answer: "Gümüş." }
    expect(
      readFaq({
        items: [
          item,
          { question: 1, answer: "x" },
          { question: " ", answer: "y" },
          item,
          item,
          item,
          item,
          item,
        ],
        dropped: 2,
      })
    ).toEqual({ items: [item, item, item, item, item] })
  })

  it("is null for an answer without items", () => {
    expect(readFaq(null)).toBeNull()
    expect(readFaq({ values: {} })).toBeNull()
  })
})

describe("faqItemIssue", () => {
  it("says what the server would refuse before it is sent", () => {
    expect(faqItemIssue({ question: "Rengi nedir?", answer: "Gümüş." })).toBeNull()
    expect(faqItemIssue({ question: "Rengi nedir", answer: "Gümüş." })).toBe("not_a_question")
    expect(faqItemIssue({ question: "Rengi nedir?", answer: " " })).toBe("empty")
    expect(faqItemIssue({ question: `${"a".repeat(120)}?`, answer: "x" })).toBe("too_long")
    expect(faqItemIssue({ question: "A?", answer: "b".repeat(401) })).toBe("too_long")
  })
})
