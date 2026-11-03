import type { Block, ContentDoc } from "../../content"
import { renderDoc } from "../../content"
import {
  ARBITRATION_LIMIT,
  LEGAL_KINDS,
  ORDER_KINDS,
  ORDER_TOKENS,
  SHOP_TOKENS,
  fillLegalDoc,
  hasStarterNote,
  starterOf,
  tokensFor,
  withPersonalLines,
  workingDaysText,
} from ".."

const doc = (content: Block[]): ContentDoc => ({ type: "doc", content })

/** Every `{name}` a document's text holds. */
const tokensIn = (body: ContentDoc): string[] => [
  ...new Set(
    [...JSON.stringify(body).matchAll(/\{([\p{L}\p{N}_]+)\}/gu)].map(([, name = ""]) => name)
  ),
]

/** Every shop and order token filled with a value of its own name. */
const filled = (body: ContentDoc): string =>
  renderDoc(
    fillLegalDoc(body, {
      text: Object.fromEntries(
        [...SHOP_TOKENS, ...ORDER_TOKENS].map((name) => [name, `«${name}»`])
      ),
      blocks: {
        sipariş_kalemleri: [{ type: "paragraph", content: [{ type: "text", text: "T" }] }],
      },
    })
  )

/** F13.7: the drafts the shop starts each text from (docs/yasal-metinler.md). */
describe("the legal texts' starting drafts", () => {
  it.each(LEGAL_KINDS)("opens %s with its note, which alone keeps it unpublished", (kind) => {
    const { body } = starterOf(kind)
    const [note, ...rest] = body.content
    const quoted = renderDoc(doc(note ? [note] : []))
    const text = renderDoc(doc(rest))

    expect(note?.type).toBe("blockquote")
    expect(quoted).toContain("TASLAK")
    // The questions for the shop's lawyer are listed in the note
    expect(quoted).toMatch(/<ol><li>/)
    expect(hasStarterNote(body)).toBe(true)
    // Deleted, nothing of the draft is left: the rest goes live as it is
    expect(hasStarterNote(doc(rest))).toBe(false)
    expect(text).not.toMatch(/taslak|avukat|\[|\.\.\./i)
  })

  it.each(LEGAL_KINDS)(
    "writes %s with the registry's tokens, an order's only in a contract",
    (kind) => {
      const used = tokensIn(starterOf(kind).body)
      const html = filled(starterOf(kind).body)

      expect(used.length).toBeGreaterThan(0)
      expect(used.filter((name) => !tokensFor(kind).includes(name))).toEqual([])
      if (!ORDER_KINDS.has(kind)) {
        expect(used.filter((name) => (ORDER_TOKENS as readonly string[]).includes(name))).toEqual(
          []
        )
      }
      // Filled, no token is left for a reader to see
      expect(html).not.toMatch(/\{[\p{L}\p{N}_]+\}/u)
    }
  )

  it.each(LEGAL_KINDS)("keeps %s well within the draft route's 100 kB body", (kind) => {
    const bytes = Buffer.byteLength(JSON.stringify(starterOf(kind)), "utf8")

    // Medusa's default JSON body limit is 100 kB; the shop's edits need room too
    expect(bytes).toBeLessThan(80_000)
  })

  it.each([...ORDER_KINDS])(
    "gives %s a withdrawal clause listing the exceptions, where the server's lines land",
    (kind) => {
      const { body } = starterOf(kind)
      const marker: Block = { type: "paragraph", content: [{ type: "text", text: "SUNUCU" }] }
      const html = renderDoc(withPersonalLines(body, { kişiye_özel_ürünler: [marker] }))
      const clause = /<h2>[^<]*Cayma[^<]*<\/h2>([\s\S]*?)(?=<h2>|$)/.exec(html)?.[1] ?? ""

      for (const letter of ["a", "b", "c", "ç", "d", "e", "f", "g", "ğ", "h"]) {
        expect(clause).toContain(`md. 15/1-${letter})`)
      }
      // Annulled by the Danıştay (ı, j, k) or repealed (i) before they applied
      expect(clause).not.toMatch(/15\/1-[ıijk]\)/)
      expect(clause).toContain("{kişiye_özel_ürünler}")
      expect(clause.indexOf("md. 15/1-h)")).toBeLessThan(clause.indexOf("{kişiye_özel_ürünler}"))
    }
  )

  it.each([...ORDER_KINDS])("names the arbitration limit in %s with its year", (kind) => {
    const html = renderDoc(starterOf(kind).body)

    expect(html).toContain(`${String(ARBITRATION_LIMIT.year)} yılı için ${ARBITRATION_LIMIT.lira}`)
    expect(html).toContain("md. 73/A")
  })

  it("says the law's refund and return deadlines as in force since 1.1.2026", () => {
    const html = renderDoc(starterOf("pre_information").body)

    // Refund: 14 days from the handover to the seller's return carrier (MSY md. 12)
    expect(html).toContain("iade için belirlediği taşıyıcıya teslim edildiği tarihten")
    // The buyer sends the goods back within 14 days, not 10 (md. 13/1)
    expect(html).toContain("14 gün içinde Satıcıya geri gönderir")
    // No return cost with the seller's carrier, nor when none was named (md. 12)
    expect(html).toContain("iade masrafından sorumlu tutulamaz")
  })
})

describe("the shipping days' tokens", () => {
  it("say a range, a single day and the same day as a sentence reads them", () => {
    expect(workingDaysText(1, 2)).toBe("1–2 iş günü")
    expect(workingDaysText(3, 3)).toBe("3 iş günü")
    expect(workingDaysText(0, 2)).toBe("2 iş günü")
    expect(workingDaysText(0, 0)).toBe("aynı iş günü")
  })
})
