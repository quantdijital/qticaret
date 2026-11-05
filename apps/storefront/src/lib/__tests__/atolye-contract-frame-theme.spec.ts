import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ImageView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * The Atölye frame with the contract's optional fields (adr/0046 Ek
 * 2026-11-04): the ETBİS QR code and the ways to pay and carriers in the
 * footer's small print, a category's picture in the mega menu. Each only
 * when the shop has it.
 */

const qr: ImageView = {
  src: "/media/etbis.png",
  alt: "ETBİS kayıt karekodu",
  width: 232,
  height: 232,
  sources: { avif: null, webp: null },
}

const payments = [
  { key: "visa", label: "Visa" },
  { key: "bank_transfer", label: "Havale / EFT" },
]
const carriers = [{ key: "aras", label: "Aras Kargo" }]

/** The footer's small print, after the identity lines. */
const smallPrint = (html: string) => html.slice(html.indexOf("MERSİS"))

describe("the Atölye footer's marks", () => {
  it("draws no slot, no list and no box without them", () => {
    const html = renderFrame(atolyeTheme, shopFixture())

    expect(html).not.toContain("Ödeme seçenekleri")
    expect(html).not.toContain("Kargo firmaları")
    expect(html).not.toContain("karekodu")
  })

  it("names the ways to pay and the carriers as text badges under their names", () => {
    const html = smallPrint(
      renderFrame(atolyeTheme, shopFixture({ paymentMarks: payments, carrierMarks: carriers }))
    )

    expect(html).toContain("<dt")
    expect(html).toContain(">Ödeme seçenekleri</dt>")
    expect(html).toContain(">Kargo firmaları</dt>")
    expect(html).toMatch(/<li class="border border-band-rule[^"]*">Visa<\/li>/)
    expect(html).toContain(">Havale / EFT</li>")
    expect(html).toContain(">Aras Kargo</li>")
    // Words only: no provider's logo is shipped
    expect(html).not.toContain("<img")
  })

  it("shows the ETBİS QR code on a light square under its own name, alone without marks", () => {
    const html = smallPrint(renderFrame(atolyeTheme, shopFixture({ etbisQr: qr })))

    expect(html).toContain(">ETBİS kayıt karekodu</dt>")
    expect(html).toMatch(/<dd><span class="block size-20 bg-band-text p-1">/)
    // The term beside it names the picture
    expect(html).toContain('<img src="/media/etbis.png" alt=""')
    expect(html).not.toContain("Ödeme seçenekleri")
  })

  it("keeps the marks between the identity lines and the year", () => {
    const html = renderFrame(atolyeTheme, shopFixture({ paymentMarks: payments, etbisQr: qr }))

    const identity = html.indexOf("Denizli V.D.")
    const marks = html.indexOf("Ödeme seçenekleri")
    const year = html.indexOf("©")
    expect(identity).toBeLessThan(marks)
    expect(marks).toBeLessThan(year)
  })
})

describe("the Atölye mega menu's category picture", () => {
  it("puts the category's picture as a square card over its own link, no box without one", () => {
    const plain = renderFrame(atolyeTheme, shopFixture())
    expect(plain).not.toContain("<img")

    const shop = shopFixture()
    const [first, ...rest] = shop.categories
    if (!first) {
      throw new Error("the fixture has categories")
    }
    const html = renderFrame(atolyeTheme, {
      ...shop,
      categories: [{ ...first, image: { ...qr, src: "/media/cakilar.jpg" } }, ...rest],
    })
    expect(html).toMatch(/<a href="\/kategori\/cakilar" class="[^"]*flex w-full max-w-60 flex-col/)
    expect(html).toMatch(/<img src="\/media\/cakilar.jpg" alt=""/)
    expect(html).toContain("Tümünü gör: Çakılar")
  })
})
