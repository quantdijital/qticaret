import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  ActionResult,
  FeaturedProductSectionView,
  HomeSectionView,
  ImageView,
  ProductCardView,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * Atölye's own close-up of one product on the home page (adr/0046 Ek
 * 2026-11-05, `featured_product`). Every field optional: without one,
 * nothing is drawn for it.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1500,
  height: 1500,
  sources: { avif: null, webp: null },
})

const card = (over: Partial<ProductCardView> = {}): ProductCardView => ({
  id: "prod_1",
  title: "Örnek Ürün 35 cm",
  path: "/urun/ornek-urun",
  brand: null,
  image: picture("kart"),
  price: { current: "1.084,30 TL", before: "1.549,00 TL", from: false, discount: 30 },
  available: true,
  ...over,
})

const featured = (over: Partial<FeaturedProductSectionView> = {}): HomeSectionView => ({
  id: "yakin",
  type: "featured_product",
  title: null,
  text: "Atölyenin bu ay öne çıkardığı model.",
  product: card(),
  subtitle: "El yapımı",
  images: [picture("bir"), picture("iki")],
  facts: [
    { label: "Uzunluk", value: "19 cm", highlight: true },
    { label: "Malzeme", value: "Ceviz", highlight: true },
  ],
  specGroups: [
    {
      title: "Ölçü",
      rows: [
        { label: "Uzunluk", value: "19 cm", highlight: true },
        { label: "Toplam boy", value: "35 cm", highlight: false },
      ],
    },
    {
      title: null,
      rows: [
        { label: "Malzeme", value: "Ceviz", highlight: true },
        { label: "Ağırlık", value: "420 g", highlight: false },
      ],
    },
    { title: "Kılıf", rows: [{ label: "Malzeme", value: "Ceviz", highlight: true }] },
  ],
  ...over,
})

const quickAdd = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })

const home = (sections: HomeSectionView[], withQuickAdd = false) =>
  renderPage(atolyeTheme, "HomePage", {
    view: { sections },
    ...(withQuickAdd ? { quickAdd } : {}),
  })

/** The close-up's own HTML. */
const closeUp = (html: string) => {
  const start = html.indexOf('<section aria-labelledby="bolum-yakin"')
  return html.slice(start, html.indexOf("</section>", start) + "</section>".length)
}

describe("the Atölye close-up of one product", () => {
  it("draws the photograph, the name as the heading, the figure, the facts and the rows", () => {
    const html = closeUp(home([featured()]))

    // A sand band of its own (Loom: the price as a figure on a sand well)
    expect(html).toContain(
      '<section aria-labelledby="bolum-yakin" class="mt-(--section-gap) bg-paper-2 py-(--section-gap-s)">'
    )
    expect(html).toContain('src="/media/bir.jpg"')
    // The photograph leads to the page for the pointer only; the action is the link a reader meets
    expect(html).toMatch(/<a href="\/urun\/ornek-urun" tabindex="-1" aria-hidden="true"/)
    expect(html).toContain('<h2 id="bolum-yakin">Örnek Ürün 35 cm</h2>')
    expect(html).toContain(">El yapımı</p>")
    expect(html).toContain("Atölyenin bu ay öne çıkardığı model.")
    // The price as the figure in the display face and the ink, the one before it struck through,
    // the red on the badge only
    expect(html).toContain('<span class="font-display text-price-hero leading-[1.1]">1.084,30 TL')
    expect(html).not.toMatch(/text-price-hero[^"]*text-discount/)
    expect(html).toContain("<s ")
    expect(html).toContain("1.549,00 TL")
    expect(html).toContain(
      '<span aria-hidden="true">%30</span><span class="sr-only">%30 indirim</span>'
    )
    // Headline facts under the price, the other rows under their sections' names
    expect(html).toContain('<dt class="text-sm text-text-3">Uzunluk</dt>')
    expect(html).toMatch(/<h3 class="[^"]*text-sm[^"]*">Ölçü<\/h3>/)
    expect(html).toContain(">Ürün özellikleri</h3>")
    expect(html).toContain(">35 cm</dd>")
    expect(html).toContain(">420 g</dd>")
    expect(html).toContain(">Ürünü incele</a>")
    // No label above the name, no borrowed section
    expect(html).not.toContain("Öne çıkan ürün")
    expect(html).not.toContain("uppercase")
  })

  it("says a headline fact once: its row leaves the sheet, a section left empty goes", () => {
    const html = closeUp(home([featured()]))

    expect(html.match(/>19 cm<\/dd>/g)).toHaveLength(1)
    expect(html.match(/>Ceviz<\/dd>/g)).toHaveLength(1)
    expect(html).not.toContain(">Kılıf</h3>")
    // Past four headline facts, the rest keep their rows
    const many = Array.from({ length: 5 }, (_, n) => ({
      label: `Özellik ${String(n + 1)}`,
      value: `${String(n + 1)} cm`,
      highlight: true,
    }))
    const five = closeUp(
      home([featured({ facts: many, specGroups: [{ title: "Ölçü", rows: many }] })])
    )
    expect(five.match(/<dt class="text-sm text-text-3">/g)).toHaveLength(4)
    expect(five).toContain(">Özellik 5</dt>")
    expect(five.match(/>5 cm<\/dd>/g)).toHaveLength(1)
  })

  it("sets a short rest of the sheet in the words' column, a long one under the photograph", () => {
    // Two rows left after the headline facts: one ruled list under the action
    const short = closeUp(home([featured()]))
    expect(short).toContain('class="grid gap-x-(--gap-columns) gap-y-6"')
    expect(short).toContain("lg:items-start")

    const rows = Array.from({ length: 9 }, (_, n) => ({
      label: `Satır ${String(n + 1)}`,
      value: `${String(n + 1)} mm`,
      highlight: false,
    }))
    const long = closeUp(
      home([
        featured({
          specGroups: [
            { title: "Bir", rows: rows.slice(0, 5) },
            { title: "İki", rows: rows.slice(5) },
          ],
        }),
      ])
    )
    expect(long).toContain('class="grid gap-x-(--gap-columns) gap-y-10 md:grid-cols-2"')
    expect(long).toContain("lg:items-center")
    expect(long).not.toContain("gap-y-6")
  })

  it("sets the catalogue name's own part as the head, the rest under it, no bar opening a line", () => {
    const title = "Örnek Model 1002 | Ceviz Saplı Siyah Model – 35 cm"
    const html = closeUp(home([featured({ product: card({ title }) })]))

    expect(html).toContain('<h2 id="bolum-yakin">Örnek Model 1002</h2>')
    expect(html).toContain('<p class="text-lg text-text-2">Ceviz Saplı Siyah Model – 35 cm</p>')
    // The quick add and the reader still have the whole name
    const withAdd = closeUp(
      home([featured({ product: card({ title, quickAdd: { variantId: "v_1" } }) })], true)
    )
    expect(withAdd).toContain(`aria-label="${title} ürününü sepete ekle"`)
  })

  it("puts the shop's heading over the name, the rows' names a level under it", () => {
    const html = closeUp(home([featured({ title: "Bu ayın seçimi" })]))

    expect(html).toContain('<h2 id="bolum-yakin">Bu ayın seçimi</h2>')
    expect(html).toContain("<h3>Örnek Ürün 35 cm</h3>")
    expect(html).toMatch(/<h4 class="[^"]*">Ölçü<\/h4>/)
  })

  it("sends the shelf's quick add from the filled button, the page's link beside it", () => {
    const html = closeUp(
      home([featured({ product: card({ quickAdd: { variantId: "v_1" } }) })], true)
    )

    expect(html).toContain('name="variant_id" value="v_1"')
    expect(html).toContain('name="quantity" value="1"')
    expect(html).toMatch(/<button type="submit" class="at-btn w-full"/)
    expect(html).toContain('aria-label="Örnek Ürün 35 cm ürününü sepete ekle"')
    expect(html).toContain("Sepete ekle</button>")
    expect(html).toContain('class="at-link">Ürünü incele</a>')
  })

  it("leads to the page alone without the action, a variant, or stock", () => {
    const withVariant = featured({ product: card({ quickAdd: { variantId: "v_1" } }) })
    expect(closeUp(home([withVariant]))).not.toContain('name="variant_id"')
    expect(closeUp(home([featured()], true))).not.toContain('name="variant_id"')

    const out = featured({ product: card({ quickAdd: { variantId: "v_1" }, stock: "out" }) })
    const html = closeUp(home([out], true))
    expect(html).not.toContain('name="variant_id"')
    expect(html).toContain(">Tükendi</p>")
    expect(html).toContain('class="at-btn">Ürünü incele</a>')

    const few = closeUp(home([featured({ product: card({ stock: "low" }) })]))
    expect(few).toContain(">Az kaldı</p>")
    expect(few).not.toMatch(/\d+ adet/)
  })

  it("shows a photograph of the product the page does not show yet", () => {
    const opening: HomeSectionView = {
      id: "giris",
      type: "hero",
      eyebrow: null,
      heading: "Atölyeden",
      intro: null,
      actions: [{ label: "Ürünleri incele", path: "/magaza" }],
      image: null,
    }
    const shelf: HomeSectionView = {
      id: "raf",
      type: "products",
      title: "Yeni ürünler",
      products: [card({ id: "prod_2", image: picture("bir") })],
      more: null,
      empty: "",
    }
    // Not the opening's photograph
    const html = closeUp(home([opening, shelf, featured()]))
    expect(html).toContain('src="/media/iki.jpg"')
    expect(html).not.toContain('src="/media/bir.jpg"')

    // Nor a shelf card's: the product's next one
    const shelved = { ...shelf, products: [card({ id: "prod_1", image: picture("bir") })] }
    const both = closeUp(
      home([
        shelved,
        featured({ images: [picture("bir"), picture("iki"), picture("uc")] }),
        { ...shelf, id: "raf2", products: [card({ id: "prod_3", image: picture("iki") })] },
      ])
    )
    expect(both).toContain('src="/media/uc.jpg"')

    // Every one of them shown already: its first
    const all = closeUp(home([shelved, featured({ images: [picture("bir")] })]))
    expect(all).toContain('src="/media/bir.jpg"')
  })

  it("says a cart offer under the price when the view carries one", () => {
    const words = "2.000,00 TL ve üzeri sepette %10 indirim"
    const price = { current: "1.549,00 TL", before: null, from: false, discount: null }
    const html = closeUp(
      home([featured({ product: card({ price: { ...price, cartOffer: words } }) })])
    )

    expect(html).toContain(words)
    expect(closeUp(home([featured({ product: card({ price }) })]))).not.toContain("sepette")
  })

  it("draws nothing for the fields it is not given", () => {
    const html = closeUp(
      home([
        featured({
          text: null,
          subtitle: null,
          images: [],
          facts: [],
          specGroups: [],
          product: card({ image: null, price: null }),
        }),
      ])
    )

    expect(html).not.toContain("<img")
    expect(html).not.toContain("<dl")
    expect(html).not.toContain("<h3")
    expect(html).not.toContain("TL")
    expect(html).not.toContain("El yapımı")
    // The name and the way to its page stay
    expect(html).toContain("Örnek Ürün 35 cm")
    expect(html).toContain(">Ürünü incele</a>")
  })
})
