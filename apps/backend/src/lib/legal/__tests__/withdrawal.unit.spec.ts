import type { Block, ContentDoc } from "../../content"
import { renderDoc } from "../../content"
import {
  PERSONAL_LINES_TOKEN,
  checkLegalDoc,
  fillLegalDoc,
  orderLegalValues,
  starterOf,
  withPersonalLines,
} from ".."
import type { OrderContractFacts } from ".."

const addons = (items: unknown[]) => ({
  qt_addons: {
    items,
    base: 1000,
    non_withdrawable: items.some(
      (item) => (item as { non_withdrawable?: boolean }).non_withdrawable
    ),
    max_quantity: 10,
  },
})
const engraving = {
  addon_id: "a1",
  kind: "text",
  label: "Ürün üzerine yazı",
  value: "Ada Yılmaz",
  amount: 35,
  non_withdrawable: true,
}
const sheath = {
  addon_id: "a2",
  kind: "choice",
  label: "Kılıf",
  choice_id: "c1",
  choice_label: "Desenli Siyah",
  amount: 300,
  non_withdrawable: false,
}

const order = (items: OrderContractFacts["items"]): OrderContractFacts => ({
  display_id: 1042,
  created_at: "2026-11-03T09:15:00.000Z",
  email: "ayse@ornek.com",
  item_total: 1835,
  shipping_total: 0,
  discount_total: 0,
  total: 1835,
  items,
  shipping_address: { first_name: "Ayşe", last_name: "Yılmaz" },
  billing_address: null,
  payment: "card",
})

const personal = order([
  {
    product_title: "Çakı",
    variant_title: "Standart",
    quantity: 1,
    total: 1335,
    metadata: addons([engraving, sheath]),
  },
  // A pick inside the right of withdrawal leaves its line out
  {
    product_title: "Bıçak",
    variant_title: null,
    quantity: 1,
    total: 1300,
    metadata: addons([sheath]),
  },
  { product_title: "Tişört", variant_title: "M", quantity: 1, total: 200 },
])

/** The text as a contract renders it: the clause placed, the tokens filled. */
const rendered = (doc: ContentDoc, facts: OrderContractFacts): string => {
  const values = orderLegalValues(facts)
  return renderDoc(fillLegalDoc(withPersonalLines(doc, values.blocks), values))
}

const SENTENCE =
  "Mesafeli Sözleşmeler Yönetmeliği md. 15/1-ç uyarınca bu ürünlerde cayma hakkı kullanılamaz"

/** adr/0052 §8: an order's contracts name the lines made to the buyer's wish. */
describe("personal lines in an order's contracts", () => {
  it.each(["pre_information", "distance_sales"] as const)(
    "names each in the %s's withdrawal clause, with the pick that makes it so",
    (kind) => {
      const html = rendered(starterOf(kind).body, personal)
      const clause = html.slice(html.indexOf("5. Cayma hakkı"), html.indexOf("6. "))

      expect(clause).toContain(SENTENCE)
      expect(clause).toContain("Çakı · Standart (Ürün üzerine yazı: Ada Yılmaz)")
      expect(clause).not.toContain("Bıçak")
      expect(clause).not.toContain("Kılıf")
      expect(html.match(/15\/1-ç/g)).toHaveLength(1)
      // The draft's lawyer note stays as the starter has it
      expect(html).toContain("TASLAK")
    }
  )

  it("adds nothing to an order without such lines", () => {
    const body = starterOf("distance_sales").body
    const plain = order([{ product_title: "Tişört", variant_title: "M", quantity: 1, total: 200 }])

    expect(orderLegalValues(plain).blocks[PERSONAL_LINES_TOKEN]).toEqual([])
    expect(withPersonalLines(body, orderLegalValues(plain).blocks)).toBe(body)
    expect(rendered(body, plain)).not.toContain("15/1-ç")
  })

  it("puts it at the end of a text that has no withdrawal heading", () => {
    const p = (text: string): Block => ({ type: "paragraph", content: [{ type: "text", text }] })
    const html = rendered({ type: "doc", content: [p("Sipariş {sipariş_no}")] }, personal)

    expect(html.indexOf("Sipariş #1042")).toBeLessThan(html.indexOf(SENTENCE))
    expect(html).toContain("Çakı · Standart (Ürün üzerine yazı: Ada Yılmaz)")
  })

  it("is no token the shop may write", () => {
    const doc: ContentDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: `{${PERSONAL_LINES_TOKEN}}` }] },
      ],
    }

    expect(checkLegalDoc(doc, "distance_sales").unknownTokens).toEqual([PERSONAL_LINES_TOKEN])
  })

  it.each(["pre_information", "distance_sales"] as const)(
    "names the gift cards in the %s's clause: withdrawn only while unused (adr/0025, TASLAK)",
    (kind) => {
      const facts = order([
        {
          product_title: "Hediye kartı",
          variant_title: "500 TL",
          quantity: 1,
          total: 500,
          gift_card: true,
        },
        // A line that recorded a recipient was sold as one, the product's mark taken off since
        {
          product_title: "Eski kart",
          variant_title: "250 TL",
          quantity: 1,
          total: 250,
          metadata: { qt_gift: { erased: true } },
        },
        { product_title: "Tişört", variant_title: "M", quantity: 1, total: 200 },
      ])
      const html = rendered(starterOf(kind).body, facts)
      const clause = html.slice(html.indexOf("5. Cayma hakkı"), html.indexOf("6. "))

      expect(clause).toContain(
        "hediye kartlarında cayma hakkı, yalnızca kartlardan hiç harcama yapılmamışken kullanılabilir"
      )
      expect(clause).toContain("Hediye kartı · 500 TL")
      expect(clause).toContain("Eski kart · 250 TL")
      expect(clause).not.toContain("Tişört")
      // Not a personal line: the add-on sentence stays out
      expect(clause).not.toContain("15/1-ç")
    }
  )

  it("puts the personal lines and the gift cards in the one block, each under its sentence", () => {
    const blocks = orderLegalValues(
      order([
        ...personal.items,
        { product_title: "Hediye kartı", quantity: 1, total: 500, gift_card: true },
      ])
    ).blocks[PERSONAL_LINES_TOKEN]

    expect(blocks?.map((block) => block.type)).toEqual([
      "paragraph",
      "bulletList",
      "paragraph",
      "bulletList",
    ])
  })
})
