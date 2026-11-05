import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ShopRatingView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The shop's rating beside the quoted reviews on the Atölye home page
 * (adr/0046 Ek 2026-11-05, the reviews section's `summary`). Without it,
 * the section is the one it was.
 */

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const summary: ShopRatingView = {
  average: "4,6",
  count: 5,
  label: "5 üzerinden 4,6 (5 değerlendirme)",
  distribution: [5, 4, 3, 2, 1].map((stars) => ({
    stars: stars as 1 | 2 | 3 | 4 | 5,
    count: stars === 5 ? 3 : stars === 4 ? 2 : stars === 1 ? 1 : 0,
    percent: stars === 5 ? 60 : stars === 4 ? 40 : stars === 1 ? 3 : 0,
    label: `${String(stars)} yıldız: değerlendirme`,
  })),
}

const reviews = (over: Partial<Extract<HomeSectionView, { type: "reviews" }>> = {}) =>
  ({
    id: "yorum",
    type: "reviews",
    title: "Müşteri yorumları",
    more: { label: "Tüm yorumlar", path: "/yorumlar" },
    reviews: [
      {
        rating: 5,
        title: null,
        body: "Elime ulaştı, çok beğendim.",
        author: "Ayşe K.",
        date: "2 Kasım 2026",
        verified: true,
        product: null,
      },
    ],
    ...over,
  }) as HomeSectionView

describe("the Atölye shop rating beside the quoted reviews", () => {
  it("draws the average, its stars, the count and the spread from five to one", () => {
    const html = home([reviews({ summary })])

    expect(html).toContain('<p class="sr-only">5 üzerinden 4,6 (5 değerlendirme)</p>')
    expect(html).toMatch(
      /<p aria-hidden="true" class="tabular font-display text-price-hero[^"]*">4,6<\/p>/
    )
    expect(html).toContain(">5 değerlendirme</p>")
    expect(html).toContain('aria-label="Puan dağılımı"')
    const rows = html.match(/<span class="sr-only">(\d) yıldız: değerlendirme<\/span>/g) ?? []
    expect(rows.map((row) => row.replace(/\D/g, ""))).toEqual(["5", "4", "3", "2", "1"])
    // The bars are width classes: the storefront's CSP refuses an inline style
    expect(html).toContain("block h-full bg-text w-[60%]")
    expect(html).toContain("block h-full bg-text w-[40%]")
    expect(html).toContain("block h-full bg-text w-0")
    // One review in a hundred still shows as a sliver
    expect(html).toContain("block h-full bg-text w-[5%]")
    expect(html).not.toContain("style=")
    // The first of four columns from 1024 px, the quotes beside it
    expect(html).toContain("lg:grid-cols-4")
  })

  it("is the section it was without the rating", () => {
    const plain = home([reviews()])
    const noSummary = home([reviews({ summary: null })])

    expect(plain).not.toContain("Puan dağılımı")
    expect(plain).not.toContain("lg:grid-cols-4")
    expect(plain).not.toContain("text-price-hero")
    expect(noSummary).toBe(plain)
    // The quotes still sit right under the head
    expect(plain).toMatch(
      /<\/div><ul class="grid gap-x-\(--gap-columns\) gap-y-10 md:grid-cols-3"><li/
    )
  })

  it("quotes a line of each beside the rating, twelve words without it", () => {
    const long = Array.from({ length: 30 }, (_, n) => `kelime${String(n)}`).join(" ")
    const said = (body: string, over: Partial<Extract<HomeSectionView, { type: "reviews" }>>) =>
      home([
        reviews({
          reviews: [
            {
              rating: 5,
              title: null,
              body,
              author: "Ayşe K.",
              date: "2 Kasım 2026",
              verified: false,
              product: null,
            },
          ],
          ...over,
        }),
      ])

    // No sentence or clause end near: ten words
    expect(said(long, { summary })).toContain("kelime9…")
    expect(said(long, { summary })).not.toContain("kelime10")
    // The first sentence whole when it ends within twelve words
    const sentence = "Kalitesine diyecek bir şey yok. Kutusu da özenliydi, teşekkürler."
    expect(said(sentence, { summary })).toContain(">Kalitesine diyecek bir şey yok.</p>")
    // Else up to its last clause within ten words
    const clause =
      "Elime ulaştığında hemen denedim, beklediğimden de iyi çıktı ve uzun süre kullanacağım gibi duruyor"
    expect(said(clause, { summary })).toContain(">Elime ulaştığında hemen denedim…</p>")
    // Without the rating, twelve words as before
    expect(said(long, {})).toContain("kelime11…")
    expect(said(sentence, {})).toContain(sentence)
  })

  it("names a quote's product by its first words beside the rating, the reader hearing all", () => {
    const label = "Örnek Model Ahşap Saplı Ürün | Pirinç Detaylı – 18,5 cm"
    const section = (over: Partial<Extract<HomeSectionView, { type: "reviews" }>> = {}) =>
      reviews({
        ...over,
        reviews: [
          {
            rating: 5,
            title: null,
            body: "Güzel.",
            author: "Ali V.",
            date: "1 Kasım 2026",
            verified: true,
            product: { label, path: "/urun/ornek" },
          },
          {
            rating: 4,
            title: null,
            body: "İyi.",
            author: "Can T.",
            date: "1 Kasım 2026",
            verified: true,
            product: { label: "Kısa Ad", path: "/urun/kisa" },
          },
        ],
      })
    const html = home([section({ summary })])

    expect(html).toContain(`<a href="/urun/ornek" aria-label="${label}"`)
    expect(html).toContain(">Örnek Model Ahşap Saplı Ürün…</a>")
    expect(html).toMatch(/<a href="\/urun\/kisa" class="at-inline-link[^"]*">Kısa Ad<\/a>/)
    // Without the rating, the whole name as before
    expect(home([section()])).toContain(`<a href="/urun/ornek" class="at-inline-link`)
    expect(home([section()])).toContain(`>${label}</a>`)
  })
})
