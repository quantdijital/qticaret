import type { ContentDoc } from "../../content"
import { MESSAGE_TEMPLATES } from "../../messaging/templates"
import type { Brand } from "../../messaging/templates"
import { emailBlocksOf, mapBlockTexts } from "../email-doc"
import type { DocContext } from "../email-doc"
import { fillName } from "../tokens"
import { campaignLink } from "../utm"

const brand: Brand = {
  shopName: "Kafe Bıçak",
  logoUrl: null,
  color: "#123456",
  contactEmail: "iletisim@magaza.example",
  contactPhone: null,
  storefrontUrl: "https://magaza.example",
}

const context = (overrides: Partial<DocContext> = {}): DocContext => ({
  link: (href) => campaignLink(href, brand.storefrontUrl, "email", "kis-abc"),
  fill: (text) => text.replace("{mağaza_adı}", brand.shopName),
  products: new Map([
    [
      "prod_01JA0000000000000000000001",
      {
        title: "Şef bıçağı",
        url: "https://magaza.example/sef?utm_campaign=kis-abc",
        image: "https://cdn.magaza.example/sef.webp",
        price: "₺1.299",
        before: "₺1.599",
      },
    ],
  ]),
  categories: new Map(),
  ...overrides,
})

const text = (value: string, href?: string) =>
  href
    ? { type: "text" as const, text: value, marks: [{ type: "link" as const, attrs: { href } }] }
    : { type: "text" as const, text: value }

describe("a campaign's document as e-mail (adr/0050 §4)", () => {
  const doc: ContentDoc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [text("Merhaba {ad}")] },
      {
        type: "paragraph",
        content: [
          text("{mağaza_adı} sizi bekliyor "),
          text("<script>alert(1)</script>"),
          text(" kampanya", "/kampanya"),
        ],
      },
      { type: "paragraph", content: [text("Alışverişe başla", "/indirim")] },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Bir")] }] }],
      },
      { type: "productCard", attrs: { id: "prod_01JA0000000000000000000001" } },
      { type: "productCard", attrs: { id: "prod_01JA0000000000000000000099" } },
    ],
  }

  it("turns headings, paragraphs, a lone link (a button), lists and product cards into blocks", () => {
    const blocks = emailBlocksOf(doc, context())
    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "rich",
      "button",
      "list",
      "products",
    ])
    expect(blocks[2]).toEqual({
      kind: "button",
      label: "Alışverişe başla",
      url: "https://magaza.example/indirim?utm_source=magaza&utm_medium=email&utm_campaign=kis-abc",
    })
    // A card for a product gone (unpublished, deleted) is left out
    expect(blocks[4]).toMatchObject({ cards: [{ title: "Şef bıçağı" }] })
  })

  it("escapes every text, links only http(s), and carries the one-click way out", () => {
    const blocks = mapBlockTexts(emailBlocksOf(doc, context()), (value) => fillName(value, "Ayşe"))
    const template = MESSAGE_TEMPLATES["marketing.campaign"]
    const mail = template.email?.(
      {
        subject: "Fırsat",
        preheader: "Önizleme",
        blocks,
        legal: "Kafe Ltd. · MERSİS 0123456789000015",
        sms: "",
        test: false,
      },
      brand,
      { unsubscribeUrl: "https://magaza.example/abonelik/cik?t=abc" }
    )
    expect(mail?.html).toContain("Merhaba Ayşe")
    expect(mail?.html).toContain("Kafe Bıçak sizi bekliyor")
    expect(mail?.html).not.toContain("<script>")
    expect(mail?.html).toContain("&lt;script&gt;")
    expect(mail?.html).toContain("utm_campaign=kis-abc")
    expect(mail?.html).toContain("<s ")
    expect(mail?.html).toContain("https://magaza.example/abonelik/cik?t=abc")
    expect(mail?.html).toContain("MERSİS 0123456789000015")
    expect(mail?.text).toContain("Bu iletileri almak istemiyorum: https://magaza.example/abonelik")
    expect(mail?.subject).toBe("Fırsat")
  })

  it("marks a test send's subject and text", () => {
    const template = MESSAGE_TEMPLATES["marketing.campaign"]
    const vars = { ...template.sample, test: true }
    expect(template.email?.(vars, brand).subject).toBe(`[Deneme] ${template.sample.subject}`)
    expect(template.sms?.(vars, brand)).toMatch(/^\[Deneme\] /)
  })

  it("keeps four product cards at most", () => {
    const ids = [1, 2, 3, 4, 5].map(
      (n) => `prod_01JA00000000000000000000${String(n).padStart(2, "0")}`
    )
    const products = new Map(
      ids.map((id) => [id, { title: id, url: null, image: null, price: null, before: null }])
    )
    const blocks = emailBlocksOf(
      { type: "doc", content: ids.map((id) => ({ type: "productCard" as const, attrs: { id } })) },
      context({ products })
    )
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: "products" })
    expect((blocks[0] as { cards: unknown[] }).cards).toHaveLength(4)
  })
})
