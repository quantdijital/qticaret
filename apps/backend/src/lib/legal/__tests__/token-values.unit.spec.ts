import type { Block, ContentDoc } from "../../content"
import { renderDoc } from "../../content"
import {
  ORDER_TOKENS,
  SHOP_TOKENS,
  addressLine,
  fillLegalDoc,
  legalDiscount,
  orderLegalValues,
  shopTokenValues,
  siteAddress,
} from ".."
import type { OrderContractFacts, ShopLegalFacts } from ".."

/** Every token as a legal text prints it: never the stored form (adr/0041 §1). */

const shop: ShopLegalFacts = {
  store_name: "  Örnek Bıçak ",
  company_title: "Örnek Bıçakçılık Ltd. Şti.",
  mersis: "0123456789012345",
  tax_office: "Kadıköy",
  tax_number: "1234567890",
  // Pasted with a tab and a line break
  address: "Caferağa Mah. Moda Cad. No: 12\tD: 3\nKadıköy / İstanbul",
  kep: "ornekbicak@hs01.kep.tr",
  etbis: "ETBIS-12345",
  contact_email: "destek@ornekbicak.com",
  contact_phone: "+905342551145",
  storefront_url: "https://www.ornekbicak.com",
  withdrawal_days: 14,
  handling_days: { min: 1, max: 2 },
  transit_days: { min: 2, max: 2 },
  today: new Date("2026-11-04T22:30:00.000Z"),
}

const SHOP_PRINTS: Record<(typeof SHOP_TOKENS)[number], string> = {
  mağaza_adı: "Örnek Bıçak",
  mağaza_unvanı: "Örnek Bıçakçılık Ltd. Şti.",
  mersis: "0123456789012345",
  vkn: "1234567890",
  vergi_dairesi: "Kadıköy",
  adres: "Caferağa Mah. Moda Cad. No: 12 D: 3 Kadıköy / İstanbul",
  kep: "ornekbicak@hs01.kep.tr",
  etbis: "ETBIS-12345",
  e_posta: "destek@ornekbicak.com",
  telefon: "0534 255 11 45",
  alan_adı: "www.ornekbicak.com",
  iade_süresi: "14",
  hazırlama_süresi: "1–2 iş günü",
  kargo_süresi: "2 iş günü",
  // 01:30 in Istanbul: already the 5th there
  bugün: "5 Kasım 2026",
}

// Medusa's amounts are lira
const order: OrderContractFacts = {
  display_id: 1042,
  created_at: "2026-10-30T09:15:00.000Z",
  email: "ayse@ornek.com",
  item_total: 1500,
  shipping_total: 59.9,
  discount_total: 150,
  total: 1409.9,
  items: [{ product_title: "Şef Bıçağı", variant_title: "20 cm", quantity: 1, total: 1500 }],
  shipping_address: {
    first_name: "Ayşe",
    last_name: " Yılmaz",
    address_1: "Atatürk Cad. No: 5",
    address_2: "Moda Mah.",
    city: "Kadıköy",
    province: "İstanbul",
    postal_code: "34710",
    // As the checkout may keep it
    phone: "0532 000 00 00",
  },
  billing_address: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    company: "Yılmaz Danışmanlık",
    address_1: "Bağdat Cad. No: 100",
    city: "Kadıköy",
    province: "İstanbul",
    postal_code: "34728",
  },
  payment: "card",
}

const ORDER_PRINTS: Record<(typeof ORDER_TOKENS)[number], string> = {
  alıcı_adı: "Ayşe Yılmaz",
  alıcı_e_posta: "ayse@ornek.com",
  alıcı_telefon: "0532 000 00 00",
  teslimat_adresi: "Moda Mah., Atatürk Cad. No: 5, 34710 Kadıköy / İstanbul",
  fatura_adresi: "Yılmaz Danışmanlık, Bağdat Cad. No: 100, 34728 Kadıköy / İstanbul",
  sipariş_no: "#1042",
  sipariş_tarihi: "30 Ekim 2026 12:15",
  // A block token: the lines' table, never text
  sipariş_kalemleri: "",
  ara_toplam: "1.500,00 TL",
  kargo_ücreti: "59,90 TL",
  indirim: "−150,00 TL",
  toplam: "1.409,90 TL",
  ödeme_yöntemi: "Kredi kartı / banka kartı",
}

describe("the shop's tokens as a legal text prints them", () => {
  const values = shopTokenValues(shop)

  it("has a printed form for every shop token", () => {
    expect(Object.keys(SHOP_PRINTS).sort()).toEqual([...SHOP_TOKENS].sort())
  })

  it.each(SHOP_TOKENS)("prints {%s} as a reader reads it", (token) => {
    expect(values[token]).toBe(SHOP_PRINTS[token])
  })

  it("prints a phone typed any way the same, and a foreign one as given", () => {
    const phone = (contact_phone: string | null) =>
      shopTokenValues({ ...shop, contact_phone }).telefon

    expect(phone("05342551145")).toBe("0534 255 11 45")
    expect(phone("+90 (534) 255-11-45")).toBe("0534 255 11 45")
    expect(phone("+90 216 123 45 67")).toBe("0216 123 45 67")
    expect(phone("+44 20 7946 0958")).toBe("+44 20 7946 0958")
    expect(phone(null)).toBeNull()
  })

  it("names the site by its host alone: no scheme, no slash, the dev storefront's port kept", () => {
    const site = (storefront_url: string | null) =>
      shopTokenValues({ ...shop, storefront_url }).alan_adı

    expect(site("https://ornekbicak.com/")).toBe("ornekbicak.com")
    expect(site("http://localhost:8000")).toBe("localhost:8000")
    expect(site("http://localhost:8000/")).toBe("localhost:8000")
    // A deployed shop with no domain yet
    expect(site(null)).toBeNull()
    expect(siteAddress("not a url")).toBeNull()
  })

  it("leaves what the shop has not given as null, so the text shows a dash", () => {
    const empty = shopTokenValues({
      ...shop,
      store_name: undefined,
      mersis: null,
      kep: " ",
      contact_phone: "",
      storefront_url: null,
    })

    expect([empty.mağaza_adı, empty.mersis, empty.kep, empty.telefon, empty.alan_adı]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ])
  })
})

describe("an order's tokens as its contracts print them", () => {
  const { text, blocks } = orderLegalValues(order)

  it("has a printed form for every order token", () => {
    expect(Object.keys(ORDER_PRINTS).sort()).toEqual([...ORDER_TOKENS].sort())
  })

  it.each(ORDER_TOKENS)("prints {%s} as a reader reads it", (token) => {
    expect(text[token]).toBe(ORDER_PRINTS[token])
  })

  it("writes each line's total in the table as prices are written", () => {
    const html = renderDoc({ type: "doc", content: blocks["sipariş_kalemleri"] ?? [] })

    expect(html).toContain("Şef Bıçağı · 20 cm")
    expect(html).toContain("1.500,00 TL")
    expect(html).not.toContain("₺")
  })

  it("prints no discount as zero, and a discount's sign however Medusa keeps it", () => {
    expect(legalDiscount(0)).toBe("0,00 TL")
    expect(legalDiscount(-25.5)).toBe("−25,50 TL")
    expect(legalDiscount("1250.00")).toBe("−1.250,00 TL")
  })

  it("joins an address the way an envelope reads, whatever is missing", () => {
    expect(
      addressLine({ address_1: "Atatürk Cad. No: 5", city: "Kadıköy", province: "İstanbul" })
    ).toBe("Atatürk Cad. No: 5, Kadıköy / İstanbul")
    // A district named as its province is written once
    expect(
      addressLine({
        address_1: "Cumhuriyet Cad. No: 3",
        city: "Bolu",
        province: "BOLU",
        postal_code: "14100",
      })
    ).toBe("Cumhuriyet Cad. No: 3, 14100 BOLU")
    expect(
      addressLine({
        address_1: "  Atatürk   Cad.\nNo: 5 ",
        address_2: "",
        city: null,
        province: "İzmir",
      })
    ).toBe("Atatürk Cad. No: 5, İzmir")
    expect(addressLine(null)).toBe("")
  })

  it("reads a phone from the billing address when the delivery one has none", () => {
    const { text: billed } = orderLegalValues({
      ...order,
      shipping_address: { ...order.shipping_address, phone: " " },
      billing_address: { ...order.billing_address, phone: "+905321112233" },
    })

    expect(billed.alıcı_telefon).toBe("0532 111 22 33")
  })
})

describe("a filled text", () => {
  const p = (text: string): Block => ({ type: "paragraph", content: [{ type: "text", text }] })
  const doc = (...content: Block[]): ContentDoc => ({ type: "doc", content })

  it("prints the shop's and an order's values, never a raw phone, scheme or ₺", () => {
    const html = renderDoc(
      fillLegalDoc(
        doc(
          p("Telefon: {telefon}. İnternet sitesi: {alan_adı}. Tarih: {bugün}."),
          p("Adres: {adres}. Toplam: {toplam}, {sipariş_tarihi}.")
        ),
        { text: { ...orderLegalValues(order).text, ...shopTokenValues(shop) } }
      )
    )

    expect(html).toContain(
      "Telefon: 0534 255 11 45. İnternet sitesi: www.ornekbicak.com. Tarih: 5 Kasım 2026."
    )
    expect(html).toContain(
      "Adres: Caferağa Mah. Moda Cad. No: 12 D: 3 Kadıköy / İstanbul. Toplam: 1.409,90 TL, 30 Ekim 2026 12:15."
    )
    expect(html).not.toMatch(/\+90|https?:|₺/u)
  })

  it("keeps words a tab or a line break parted apart, given a raw value", () => {
    const filled = fillLegalDoc(doc(p("Adres: {adres}")), {
      text: { adres: "Moda Cad. No: 12\tD: 3\r\nKadıköy" },
    })

    expect(filled.content[0]).toEqual(p("Adres: Moda Cad. No: 12 D: 3 Kadıköy"))
  })
})
