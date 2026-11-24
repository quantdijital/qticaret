import { describe, expect, it } from "vitest"
import {
  answerDoc,
  dropTo,
  duplicatedRow,
  isFaqTitle,
  movedRow,
  newQuestion,
  rowNumbers,
  withAnswer,
} from "./faq-rows"

const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

// An FAQ's rows as the form edits them (adr/0073 Ek 2026-11-24 (2))
describe("an FAQ's rows", () => {
  it("shows a plain answer from before as a paragraph, and writes it back as a rich one", () => {
    const plain = { question: "Kargo?", answer: "Aynı gün." }
    expect(answerDoc(plain)).toEqual(paragraph("Aynı gün."))
    expect(answerDoc(newQuestion())).toEqual({ type: "doc", content: [] })
    expect(withAnswer(plain, paragraph("Yarın."))).toEqual({
      question: "Kargo?",
      body: paragraph("Yarın."),
    })
  })

  it("moves, copies and numbers rows, each kind on its own", () => {
    const rows = [
      { heading: "Kargo" },
      { question: "A?", body: paragraph("a") },
      { question: "B?", answer: "b" },
    ]
    expect(movedRow(rows, 2, 0)).toEqual([rows[2], rows[0], rows[1]])
    const copied = duplicatedRow(rows, 1)
    expect(copied).toEqual([rows[0], rows[1], rows[1], rows[2]])
    // A copy, not the same row: editing one leaves the other
    expect(copied[2]).not.toBe(rows[1])
    expect(rowNumbers(copied)).toEqual([1, 1, 2, 3])
  })

  it("lands a dragged row before or after another, nowhere when it would not move", () => {
    expect(dropTo(0, 2, "after")).toBe(2)
    expect(dropTo(0, 2, "before")).toBe(1)
    expect(dropTo(3, 1, "before")).toBe(1)
    expect(dropTo(1, 1, "after")).toBeNull()
    expect(dropTo(1, 2, "before")).toBeNull()
  })

  it("tells a questions page by its title", () => {
    for (const title of [
      "Sık Sorulan Sorular",
      "SIKÇA SORULAN SORULAR",
      "SSS",
      "Kargo SSS",
      "FAQ",
    ]) {
      expect(isFaqTitle(title)).toBe(true)
    }
    for (const title of ["Hakkımızda", "Kargo ve teslimat", "Sssaat"]) {
      expect(isFaqTitle(title)).toBe(false)
    }
  })
})
