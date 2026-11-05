import { describe, expect, it } from "vitest"
import type { LegalIdentity } from "@qticaret/types"
import { t } from "@/lib/i18n"
import {
  cardProductIds,
  familyName,
  identityRows,
  installmentRates,
  postMeta,
  shareLinks,
} from "../content-extras"

// The content pages' extras in words (adr/0046 Ek 2026-11-05 içerik sayfaları)

const identity = (over: Partial<LegalIdentity> = {}): LegalIdentity => ({
  company_title: "Örnek Atölye Ltd. Şti.",
  mersis: "0123456789000015",
  tax_office: "Pamukkale",
  tax_number: "1234567890",
  address: "Örnek Mah. 1. Sok. No: 1, Denizli",
  kep: null,
  etbis: "  ",
  same_as: [],
  email: "bilgi@example.com",
  phone: "+905320000000",
  whatsapp: null,
  opening_hours: [],
  map_url: null,
  ...over,
})

describe("postMeta", () => {
  it("says the date in Turkish, the reading time and the author; no author when blank", () => {
    expect(
      postMeta(
        { published_at: "2026-10-30T09:00:00.000Z", reading_minutes: 9, author_name: " Usta " },
        t
      )
    ).toEqual({
      date: "30 Ekim 2026",
      dateTime: "2026-10-30T09:00:00.000Z",
      reading: "9 dk okuma",
      author: "Usta",
    })
    expect(postMeta({ published_at: null, reading_minutes: 1, author_name: "" }, t)).toMatchObject({
      date: null,
      author: null,
    })
  })
})

describe("shareLinks", () => {
  it("gives each network its own share address with the page's address and title, nothing else", () => {
    const links = shareLinks("https://ornek.com/blog/celik", "Çelik & bakım", t)
    expect(links.map((link) => link.label)).toEqual(["WhatsApp", "X", "Facebook", "E-posta"])
    expect(links[0]?.href).toBe(
      "https://wa.me/?text=%C3%87elik%20%26%20bak%C4%B1m%20https%3A%2F%2Fornek.com%2Fblog%2Fcelik"
    )
    expect(links[2]?.href).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fornek.com%2Fblog%2Fcelik"
    )
    expect(links[3]?.href.startsWith("mailto:?subject=")).toBe(true)
  })

  it("shares nothing before the shop has its canonical address", () => {
    expect(shareLinks(null, "Başlık", t)).toEqual([])
  })
})

describe("cardProductIds", () => {
  it("reads the text's product cards once each, in order, never a category card", () => {
    const html =
      '<aside class="qt-card qt-card--product" data-product-id="prod_B"><a href="/b">B</a></aside>' +
      '<aside class="qt-card qt-card--category" data-category-id="pcat_A"><a href="/a">A</a></aside>' +
      '<aside class="qt-card qt-card--product" data-product-id="prod_A"><a href="/a">A</a></aside>' +
      '<aside class="qt-card qt-card--product" data-product-id="prod_B"><a href="/b">B</a></aside>'
    expect(cardProductIds(html)).toEqual(["prod_B", "prod_A"])
  })
})

describe("identityRows", () => {
  it("lists only the imprint facts the shop filled in, tax office and number together", () => {
    expect(identityRows(identity(), t)).toEqual([
      { label: "Unvan", value: "Örnek Atölye Ltd. Şti." },
      { label: "Adres", value: "Örnek Mah. 1. Sok. No: 1, Denizli" },
      { label: "MERSİS numarası", value: "0123456789000015" },
      { label: "Vergi dairesi / numarası", value: "Pamukkale / 1234567890" },
    ])
    expect(
      identityRows(identity({ tax_number: null, kep: "ornek@hs01.kep.tr" }), t)
    ).toContainEqual({
      label: "KEP adresi",
      value: "ornek@hs01.kep.tr",
    })
  })
})

describe("installmentRates", () => {
  it("drops the one-payment row, words each surcharge, names the family as its cards do", () => {
    expect(
      installmentRates(
        [
          {
            family: "world",
            options: [
              { count: 1, rate: 0 },
              { count: 2, rate: 0 },
              { count: 3, rate: 5.7 },
            ],
          },
          { family: "only-one", options: [{ count: 1, rate: 0 }] },
        ],
        t
      )
    ).toEqual([
      {
        family: "World",
        options: [
          { count: 2, free: true, rate: "Vade farksız" },
          { count: 3, free: false, rate: "%5,70" },
        ],
      },
    ])
  })

  it("keeps an unknown family's name as the provider gives it", () => {
    expect(familyName("cardfinans")).toBe("CardFinans")
    expect(familyName("Yeni Kart")).toBe("Yeni Kart")
  })
})
