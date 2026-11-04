import type { Block, ContentDoc } from "../../content"
import { contentDoc, renderDoc } from "../../content"
import { isValidationError } from "../../errors"
import {
  LEGAL_KINDS,
  assertLegalTokens,
  checkLegalDoc,
  fillLegalDoc,
  hasStarterNote,
  identityGaps,
  orderLegalValues,
  starterOf,
  withoutStarterNote,
} from ".."
import type { OrderContractFacts } from ".."

const doc = (...content: Block[]): ContentDoc => ({ type: "doc", content })
const p = (text: string): Block => ({ type: "paragraph", content: [{ type: "text", text }] })

describe("legal texts (adr/0041 §1)", () => {
  it.each(LEGAL_KINDS)("starts %s from a draft the editor takes and the checker passes", (kind) => {
    const { title, body } = starterOf(kind)

    expect(title.length).toBeGreaterThan(0)
    expect(contentDoc.safeParse(body).success).toBe(true)
    expect(checkLegalDoc(body, kind)).toEqual({ unknownTokens: [], isMalformed: false, broken: [] })
    // Each says, in its note for the shop, it is a draft with points for a lawyer
    expect(renderDoc(body)).toContain("Avukatınızla kontrol etmeye değer noktalar")
  })

  it("refuses an unknown token, a token split by formatting, and an order's in a policy", () => {
    expect(checkLegalDoc(doc(p("{mağaza_unvanı} {uydurma}")), "privacy_notice")).toEqual({
      unknownTokens: ["uydurma"],
      isMalformed: false,
      broken: [],
    })
    expect(checkLegalDoc(doc(p("Ad: {alıcı_adı")), "distance_sales").isMalformed).toBe(true)
    expect(checkLegalDoc(doc(p("{alıcı_adı}")), "return_policy").unknownTokens).toEqual([
      "alıcı_adı",
    ])
    expect(checkLegalDoc(doc(p("{alıcı_adı}")), "distance_sales").unknownTokens).toEqual([])
  })

  it("names every unknown and broken token in its refusal, so all are fixed in one go", () => {
    const refusal = (body: ContentDoc): unknown => {
      try {
        assertLegalTokens(body, "return_policy")
      } catch (error) {
        return error
      }
      return null
    }
    const thrown = refusal(
      doc(
        p("Süre {iade_süresi} gün, alıcı {alıcı_adı}, satıcı {uydurma}."),
        p("Adres: {adres"),
        p("Unvan: {mağaza unvanı} ve {}"),
        p("Yine {uydurma}.")
      )
    )

    expect(isValidationError(thrown)).toBe(true)
    expect(thrown).toMatchObject({
      safeMessage: "legal.token_invalid",
      field: "body",
      values: { tokens: "{alıcı_adı}, {uydurma}, {adres, {mağaza unvanı}, {}" },
    })
    expect(refusal(doc(p("Süre {iade_süresi} gün.")))).toBeNull()
    // A long list is cut, saying there is more
    const many = refusal(
      doc(p(Array.from({ length: 12 }, (_, i) => `{yok_${String(i)}}`).join(" ")))
    )
    expect((many as { values: { tokens: string } }).values.tokens).toMatch(/\{yok_9\} …$/)
  })

  it("fills text tokens, opens a block token at the top only, and marks what has no value", () => {
    const lines: Block[] = [{ type: "table", content: [] }]
    const filled = fillLegalDoc(
      doc(p("Satıcı: {mağaza_unvanı}, MERSİS: {mersis}"), p("{sipariş_kalemleri}"), {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "{sipariş_kalemleri}" }] },
            ],
          },
        ],
      }),
      {
        text: { mağaza_unvanı: "Örnek Ltd. Şti.", mersis: "" },
        blocks: { sipariş_kalemleri: lines },
      }
    )

    expect(filled.content[0]).toEqual(p("Satıcı: Örnek Ltd. Şti., MERSİS: —"))
    expect(filled.content[1]).toEqual(lines[0])
    expect(JSON.stringify(filled.content[2])).toContain('"text":"—"')
  })

  it("drops control and direction characters from a filled value", () => {
    const filled = fillLegalDoc(doc(p("Alıcı: {alıcı_adı}"), p("{alıcı_telefonu}")), {
      text: { alıcı_adı: "Ayşe‮İ\u0007 Yılmaz", alıcı_telefonu: "​⁦" },
      blocks: {},
    })

    expect(filled.content[0]).toEqual(p("Alıcı: Ayşeİ Yılmaz"))
    expect(filled.content[1]).toEqual(p("—"))
  })
})

describe("the starter's draft note (F13.7)", () => {
  it.each(LEGAL_KINDS)("is found in the %s starter as it comes", (kind) => {
    expect(hasStarterNote(starterOf(kind).body)).toBe(true)
  })

  it("is removed whole when published, edited or not, and nothing else with it", () => {
    const { body } = starterOf("distance_sales")
    const [note, ...rest] = body.content
    const quote = (...texts: string[]): Block => ({
      type: "blockquote",
      content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
    })
    const edited = quote("Avukatım baktı.", "TASLAK: Bu metin bir başlangıç iskeletidir, eski not.")
    const ownQuote = quote("Mağazanın kendi alıntısı.")

    expect(note?.type).toBe("blockquote")
    expect(withoutStarterNote(body)).toEqual(doc(...rest))
    expect(hasStarterNote(withoutStarterNote(body))).toBe(false)
    // The older wording (drafts saved before 2026-11-04) goes the same way; the shop's own box stays
    expect(withoutStarterNote(doc(ownQuote, edited, ...rest, edited))).toEqual(
      doc(ownQuote, ...rest)
    )
    // No note: the very same document
    const plain = doc(p("Metin."))
    expect(withoutStarterNote(plain)).toBe(plain)
  })

  it("is found once edited, split by formatting or moved, and gone once deleted", () => {
    const { body } = starterOf("return_policy")
    const [note, ...rest] = body.content
    const split: Block = {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bu metin bir " },
            { type: "text", text: "başlangıç", marks: [{ type: "bold" }] },
            { type: "text", text: "  iskeletidir." },
          ],
        },
      ],
    }

    expect(note?.type).toBe("blockquote")
    expect(hasStarterNote(doc(...rest))).toBe(false)
    expect(hasStarterNote(doc(...rest, split))).toBe(true)
    expect(hasStarterNote(doc(p("Taslak: BU METİN BİR BAŞLANGIÇ İSKELETİDİR")))).toBe(true)
    // The shop's own words about drafts are its own
    expect(hasStarterNote(doc(p("Bu metin taslak değildir.")))).toBe(false)
  })
})

describe("the shop's legal identity (F13.9)", () => {
  const complete = {
    company_title: "Örnek Ticaret Ltd. Şti.",
    address: "Örnek Mah. 1. Sok. No: 2, Kadıköy / İstanbul",
    tax_office: "Kadıköy",
    tax_number: "1234567890",
    contact_email: "destek@ornek.com",
    contact_phone: null,
  }

  it("asks for the title, address, tax details and one way to reach the shop", () => {
    expect(identityGaps(complete)).toEqual([])
    expect(
      identityGaps({ ...complete, company_title: " ", contact_email: null, contact_phone: null })
    ).toEqual(["company_title", "contact"])
    expect(
      identityGaps({ ...complete, contact_email: null, contact_phone: "+905320000000" })
    ).toEqual([])
  })
})

describe("an order's contract values (F13.2)", () => {
  // Medusa's amounts are lira
  const order: OrderContractFacts = {
    display_id: 1042,
    created_at: "2026-10-30T09:15:00.000Z",
    email: "ayse@ornek.com",
    item_total: 500,
    shipping_total: 59.9,
    discount_total: 0,
    total: 559.9,
    items: [{ product_title: "Pamuklu Tişört", variant_title: "M", quantity: 2, total: 500 }, null],
    shipping_address: {
      first_name: "Ayşe",
      last_name: "Yılmaz",
      address_1: "Atatürk Cad. No: 5",
      address_2: "Moda Mah.",
      city: "Kadıköy",
      province: "İstanbul",
      postal_code: "34710",
      phone: "+905320000000",
    },
    billing_address: null,
    payment: "bank_transfer",
  }

  it("fills the buyer, the addresses, the lines and the totals as the order holds them", () => {
    const { text, blocks } = orderLegalValues(order)

    expect(text).toMatchObject({
      alıcı_adı: "Ayşe Yılmaz",
      alıcı_telefon: "+905320000000",
      teslimat_adresi: "Moda Mah., Atatürk Cad. No: 5, Kadıköy / İstanbul, 34710",
      // No billing address given: the delivery one
      fatura_adresi: "Moda Mah., Atatürk Cad. No: 5, Kadıköy / İstanbul, 34710",
      sipariş_no: "#1042",
      sipariş_tarihi: "30.10.2026 12:15",
      toplam: "₺559,90",
      indirim: "₺0,00",
      ödeme_yöntemi: "Havale / EFT",
    })
    expect(JSON.stringify(blocks["sipariş_kalemleri"])).toContain("Pamuklu Tişört · M")
  })

  it("leaves a cart's number, date and way to pay to show as missing", () => {
    const { text } = orderLegalValues({
      ...order,
      display_id: null,
      created_at: null,
      payment: null,
    })

    expect([text.sipariş_no, text.sipariş_tarihi, text.ödeme_yöntemi]).toEqual(["", "", ""])
  })
})
