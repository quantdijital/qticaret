import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CategoryCardsView, HomeSectionView, LinkedCategoryCardView } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The parts a classic catalogue look needs (adr/0049 Ek 2026-11-15): the
 * linked category cards, the footer's profile signs and written ways to
 * pay, and the floating "Yukarı çık".
 */

const card = (name: string, children: string[], count?: number): LinkedCategoryCardView => ({
  label: name,
  path: `/kategori/${name.toLowerCase()}`,
  image: {
    src: `/media/${name}.jpg`,
    alt: name,
    width: 400,
    height: 400,
    sources: { avif: null, webp: null },
  },
  ...(count === undefined ? {} : { count }),
  children: children.map((child) => ({ label: child, path: `/kategori/${child.toLowerCase()}` })),
  all:
    children.length > 0 ? { label: "Tümünü gör", path: `/kategori/${name.toLowerCase()}` } : null,
})

const cards = (over: Partial<CategoryCardsView> = {}): HomeSectionView => {
  const list = [card("Mutfak", ["Tencere", "Tava"], 42), card("Bahçe", [])]
  return {
    id: "kartlar",
    type: "categories",
    title: "Reyonlar",
    categories: list,
    variant: "linked",
    linked: { columns: 3, imagePosition: "side", frame: "lined", cards: list, ...over },
  }
}

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

describe("the linked category cards", () => {
  it("draws each card with its name, count, first subcategories and a named see-all link", () => {
    const html = home([cards()])

    expect(html).toContain(">Reyonlar</h2>")
    expect(html.match(/<h3/g)).toHaveLength(2)
    expect(html).toContain('href="/kategori/tencere"')
    expect(html).toContain('href="/kategori/tava"')
    expect(html).toContain('Tümünü gör<span class="sr-only">: Mutfak</span>')
    expect(html).toContain("42 ürün")
    // One column on a phone, two from 640 px, the shop's three from 1024 px; nothing scrolls sideways
    expect(html).toContain("grid grid-cols-1 sm:grid-cols-2")
    expect(html).toContain("lg:grid-cols-3")
    expect(html).not.toContain("gf-rail")
    // The picture is decoration on the same page: not a second keyboard stop
    expect(html).toMatch(/<a href="\/kategori\/mutfak" tabindex="-1" aria-hidden="true"/)
    // A card without a shown subcategory has no see-all link
    expect(html.match(/Tümünü gör/g)).toHaveLength(1)
    // ...and is one link, its words centred in the row's height, no empty list (K-08);
    // the see-all link sits at the card's foot, with no arrow (K-09)
    expect(html.match(/after:absolute after:inset-0/g)).toHaveLength(1)
    expect(html).toContain("flex-row items-center")
    expect(html).not.toContain("lucide-arrow-right")
    expect(html).toMatch(/class="gf-link mt-auto[^"]*">Tümünü gör/)
  })

  it("lays out four columns, pictures above or none, plain cards", () => {
    const four = home([cards({ columns: 4, imagePosition: "top", frame: "plain" })])
    expect(four).toContain("xl:grid-cols-4")
    expect(four).toContain("aspect-[4/3]")
    expect(four).not.toContain("border border-rule bg-field")
    const bare = home([cards({ imagePosition: "none" })])
    expect(bare).not.toContain('src="/media/Mutfak.jpg"')
  })

  it("draws today's tiles for a section without the linked view", () => {
    const html = home([
      { id: "kartlar", type: "categories", title: "Reyonlar", categories: [card("Mutfak", [])] },
    ])
    expect(html).not.toContain("<h3")
    expect(html).toContain("aspect-[4/5]")
  })
})

describe("the footer's own settings", () => {
  const profiles = [
    { label: "Instagram", href: "https://www.instagram.com/ornek", network: "instagram" as const },
    { label: "X", href: "https://x.com/ornek", network: "x" as const },
    { label: "ornek-blog.com", href: "https://ornek-blog.com/", network: null },
  ]

  it("writes the profiles as before, with no referrer", () => {
    const html = renderFrame(atolyeTheme, shopFixture({ social: profiles }))
    expect(html).toContain(">Instagram</a>")
    expect(html).toContain('rel="noopener noreferrer me"')
  })

  it("draws a sign for each profile on request, named by its network; or none", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        social: profiles,
        footerBar: { id: "mainfooter", variant: "ledger", social: "icons" },
      })
    )
    expect(html).toContain('aria-label="Instagram"')
    expect(html).toContain('aria-label="X"')
    expect(html).toContain('aria-label="ornek-blog.com"')
    expect(html).not.toContain(">Instagram</a>")
    // An address the storefront does not know: its first letter
    expect(html).toMatch(/aria-hidden="true"[^>]*>O<\/span>/)
    const hidden = renderFrame(
      atolyeTheme,
      shopFixture({
        social: profiles,
        footerBar: { id: "mainfooter", variant: "ledger", social: "hidden" },
      })
    )
    expect(hidden).not.toContain("https://www.instagram.com/ornek")
  })

  it("writes the ways to pay the shop named in its order, in the providers' marks' place", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        paymentMarks: [
          { key: "visa", label: "Visa", logo: { src: "/marks/visa.png", width: 208, height: 68 } },
        ],
        footerBar: {
          id: "mainfooter",
          variant: "ledger",
          paymentBadges: [
            { key: "troy", label: "Troy" },
            { key: "installments", label: "Taksit imkânı" },
          ],
        },
      })
    )
    expect(html).toContain('<ul aria-label="Ödeme seçenekleri"')
    expect(html).toMatch(/>Troy<\/li><li[^>]*>Taksit imkânı<\/li>/)
    expect(html).not.toContain('src="/marks/visa.png"')
  })

  it("adds the floating button only when the shop turned it on, clear of WhatsApp", () => {
    expect(renderFrame(atolyeTheme, shopFixture())).not.toContain("data-back-to-top")
    const on = (backToTop: {
      side: "right" | "left"
      shape: "round" | "square"
      mobile: boolean
    }) =>
      renderFrame(
        atolyeTheme,
        shopFixture({ footerBar: { id: "mainfooter", variant: "ledger", backToTop } })
      )
    const right = on({ side: "right", shape: "round", mobile: true })
    expect(right).toMatch(/<button type="button" aria-label="Yukarı çık"[^>]*data-back-to-top=""/)
    // Above the WhatsApp button and the bottom bar on the same side
    expect(right).toContain("bottom-[calc(9.5rem+env(safe-area-inset-bottom))]")
    expect(right).toContain("rounded-pill")
    const left = on({ side: "left", shape: "square", mobile: false })
    expect(left).toContain("left-2")
    expect(left).toContain("bottom-[calc(5rem+env(safe-area-inset-bottom))]")
    expect(left).toContain("rounded-inner")
    expect(left).toContain("max-lg:hidden")
    // A 40 px face; inside the 48 px gutter wider than 1024 px, 4 px from the edge (K-10, Y-02)
    expect(right).toContain("size-10")
    expect(right).not.toContain("size-12")
    expect(right).toContain("min-[64.0625rem]:right-1")
    // One way up: the footer line's link goes where the button shows
    const link = /<a href="#top"[^>]*>/
    expect(renderFrame(atolyeTheme, shopFixture())).toMatch(link)
    expect(right).not.toMatch(link)
    expect(left).toMatch(/<a href="#top" class="lg:hidden /)
  })

  it("leaves the button out while the cookie question waits", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        footerBar: {
          id: "mainfooter",
          variant: "ledger",
          backToTop: { side: "right", shape: "round", mobile: true },
        },
        cookieBanner: { due: true } as never,
      })
    )
    expect(html).not.toContain("data-back-to-top")
  })
})
