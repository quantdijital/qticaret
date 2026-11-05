import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  ActionResult,
  ImageView,
  ProductPageView,
  ThemeActions,
  VariantView,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Grafit theme's product page: the photographs in a soft well with
 * their thumbnails under them, the buy column (name, stars, price with
 * its rules, options, add-ons, the one buy form the phone's bar also
 * submits), the description and the ruled spec table as two tabs, the
 * reviews right after, the questions, the related products. Prices are
 * the storefront's words; nothing is computed here.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1000,
  height: 1000,
  sources: { avif: `/media/${name}-800.avif 800w`, webp: null },
})

const ok = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })

const actions: ThemeActions = {
  addToCart: ok,
  changeCartLine: () => Promise.resolve(),
  applyPromotion: ok,
  removePromotion: () => Promise.resolve(),
  writeReview: ok,
  askQuestion: ok,
  stockAlert: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  addFavorite: ok,
  installments: () => Promise.resolve(null),
  addAddonsToCart: ok,
  addGiftToCart: ok,
}

const variant = (id: string, color: string, over: Partial<VariantView> = {}): VariantView => ({
  id,
  title: color,
  options: { opt_renk: color },
  price: {
    current: "1.837,50 TL",
    before: "2.625,00 TL",
    from: false,
    discount: 30,
    saving: "787,50 TL",
    cartOffer: "2.000,00 TL ve üzeri sepette %10 indirim",
  },
  kurus: 183750,
  available: true,
  sku: null,
  ...over,
})

const view = (over: Partial<ProductPageView> = {}): ProductPageView => ({
  id: "prod_1",
  title: "Yeşil Saplı Çakı | İçten Kilitli – 21 cm",
  subtitle: null,
  description: ["Düz metin açıklama."],
  descriptionHtml: "<h2>Namlu</h2><p>Elmax çelik namlu.</p>",
  brand: { label: "Atölye", path: "/marka/atolye" },
  breadcrumbs: [
    { label: "Ana sayfa", path: "/" },
    { label: "Çakılar", path: "/kategori/cakilar" },
    { label: "Yeşil Saplı Çakı", path: null },
  ],
  images: [picture("one"), picture("two"), picture("three")],
  options: [{ id: "opt_renk", title: "Renk", values: ["Yeşil", "Mavi"] }],
  variants: [variant("v_yesil", "Yeşil"), variant("v_mavi", "Mavi")],
  selectedVariantId: "v_yesil",
  specs: [
    { label: "Namlu çeliği", value: "Elmax", highlight: true },
    { label: "Toplam boy", value: "21 cm", highlight: false },
  ],
  specGroups: [
    { title: "Namlu", rows: [{ label: "Namlu çeliği", value: "Elmax", highlight: true }] },
    { title: "Ölçü ve ağırlık", rows: [{ label: "Toplam boy", value: "21 cm", highlight: false }] },
  ],
  trustBadges: [{ icon: "truck", title: "Aynı gün kargo", text: "Hafta içi 16:00'a kadar" }],
  reviews: {
    average: 4.5,
    count: 2,
    items: [
      {
        rating: 5,
        title: "Çok iyi",
        body: "Eline sağlık, tam anlatıldığı gibi.",
        author: "Ayşe K.",
        date: "1 Kasım 2026",
        verified: true,
        photos: [{ image: picture("yorum") }],
      },
    ],
    distribution: [
      { stars: 5, count: 1, percent: 50, label: "5 yıldız: 1 değerlendirme" },
      { stars: 4, count: 1, percent: 50, label: "4 yıldız: 1 değerlendirme" },
    ],
  },
  questions: {
    count: 1,
    items: [
      {
        body: "Kılıfı var mı?",
        author: "Mehmet",
        date: "2 Kasım 2026",
        answers: [{ body: "Deri kılıfıyla gelir.", author: "Atölye", byShop: true }],
      },
    ],
  },
  related: [
    {
      id: "rel",
      title: "Mavi Saplı Çakı",
      path: "/urun/mavi",
      brand: null,
      image: picture("mavi"),
      price: { current: "999,00 TL", before: null, from: false, discount: null },
      available: true,
    },
  ],
  whatsappHref: "https://wa.me/905320000000?text=x",
  signedIn: false,
  loginPath: "/hesap/giris?sonra=%2Furun%2Fcaki",
  shippingNote: "1.500,00 TL ve üzeri siparişlerde kargo ücretsiz.",
  ...over,
})

const page = (over: Partial<ProductPageView> = {}) =>
  renderPage(atolyeTheme, "ProductPage", { view: view(over), actions })

describe("the theme's product page", () => {
  it("has one h1: the name, its detail on a second line of the same heading", () => {
    const html = page()
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>Yeşil Saplı Çakı<span[^>]*>İçten Kilitli – 21 cm<\/span><\/h1>/)
    expect(html).toContain('href="/marka/atolye"')
  })

  it("on a phone the trail is the one step back", () => {
    const html = page()
    expect(html).toMatch(/<a href="\/kategori\/cakilar" class="[^"]*sm:hidden"/)
  })

  it("puts the photographs in a well over their thumbnails: the first eager, anchors before the script", () => {
    const html = page()
    expect(html).toContain("relative overflow-hidden rounded-tile bg-paper-2")
    expect(html).not.toContain("gf-stage relative overflow-hidden rounded-tile")
    expect(html.match(/fetchPriority="high"/g)).toHaveLength(1)
    expect(html).toContain('id="gorsel-kucukleri"')
    expect(html).toContain('href="#gorsel-2"')
    expect(html).toContain('id="gorsel-3"')
    expect(html).toContain("1 / 3")
    // Buttons that need the script are not in the first HTML; three thumbnails never slide
    expect(html).not.toContain("Görseli büyüt")
    expect(html).not.toContain("grid-cols-[2rem_minmax(0,1fr)_2rem]")
  })

  it("lets more than four thumbnails slide, their arrows only with the script", () => {
    const html = page({ images: [1, 2, 3, 4, 5, 6].map((n) => picture(`foto-${String(n)}`)) })
    expect(html.match(/<a href="#gorsel-\d"/g)).toHaveLength(6)
    expect(html).toContain("grid-cols-[2rem_minmax(0,1fr)_2rem]")
    expect(html).not.toContain("Sonraki görseller")
  })

  it("links the stars to the reviews and shows the shop's headline facts", () => {
    const html = page()
    expect(html).toContain('href="#degerlendirmeler"')
    expect(html).toContain(">4,5</span>")
    expect(html).toContain("Namlu çeliği: </dt>")
  })

  it("shows the price with its rules: the price before struck, the discount, the saving, the cart offer", () => {
    const html = page()
    expect(html).toContain(">1.837,50 TL</span>")
    expect(html).toMatch(/<s[^>]*><span class="sr-only">Önceki fiyat: <\/span>2\.625,00 TL<\/s>/)
    expect(html).toContain("%30 indirim")
    expect(html).toContain("787,50 TL tasarruf")
    expect(html).toContain("2.000,00 TL ve üzeri sepette %10 indirim")
    expect(html).toContain(">Stokta</p>")
  })

  it("has one buy form the row's button, the quantity and the phone's bar all submit", () => {
    const html = page()
    expect(html).toContain('id="sepet-formu"')
    const radios = html.match(/<input[^>]*name="option_opt_renk"[^>]*>/g) ?? []
    expect(radios).toHaveLength(2)
    expect(radios.find((radio) => radio.includes('value="Yeşil"'))).toContain('checked=""')
    expect(html).toContain('name="variant_id" value="v_yesil"')
    expect(html.match(/form="sepet-formu"/g)?.length).toBeGreaterThanOrEqual(2)
    expect(/<input[^>]*name="quantity"[^>]*>/.exec(html)?.[0]).toContain('form="sepet-formu"')
    expect(html).toContain('data-sticky-buy=""')
    expect(html).toContain('data-open="false"')
    // A guest's heart is the way to sign in
    expect(html).toMatch(/href="\/hesap\/giris\?sonra=%2Furun%2Fcaki" aria-label="Favorilere ekle"/)
    expect(html).toContain("Taksit seçenekleri")
  })

  it("asks the floating WhatsApp to keep off its controls: the buy column with the heart, the tabs, the reviews", () => {
    const html = page()
    const top = /<div class="[^"]*gf-product-top[^"]*"[^>]*>/.exec(html)?.[0] ?? ""
    expect(top).toContain('data-gf-clear=""')
    expect(html.indexOf('data-gf-clear=""')).toBeLessThan(html.indexOf("data-buy-row"))
    // The tabs, the reviews and the related products under it
    expect(html.match(/data-gf-clear=""/g)).toHaveLength(2)
    expect(html.lastIndexOf('data-gf-clear=""')).toBeLessThan(html.indexOf('role="tablist"'))
  })

  it("marks a value sold out before it is chosen, and the phone's bar says the choice", () => {
    const html = page({
      variants: [variant("v_yesil", "Yeşil"), variant("v_mavi", "Mavi", { available: false })],
    })
    // The sold-out value stays a choice (its stock alert), its words struck and read as sold out
    const label =
      /<label[^>]*for="secenek-opt_renk-Mavi"[^>]*>[\s\S]*?<\/label>/.exec(html)?.[0] ?? ""
    expect(label).toContain("line-through")
    expect(label).toContain("Tükendi")
    const kept =
      /<label[^>]*for="secenek-opt_renk-Yeşil"[^>]*>[\s\S]*?<\/label>/.exec(html)?.[0] ?? ""
    expect(kept).not.toContain("line-through")
    // The bar names what goes in: the choice, not the name again
    const bar = /<aside[^>]*data-sticky-buy=""[\s\S]*?<\/aside>/.exec(html)?.[0] ?? ""
    expect(bar).toContain("Renk: Yeşil")
  })

  it("draws no choice for an option of one value", () => {
    const html = page({
      options: [{ id: "opt_renk", title: "Seçenek", values: ["Standart"] }],
      variants: [variant("v_tek", "Standart")],
      selectedVariantId: "v_tek",
    })
    expect(html).not.toContain('name="option_opt_renk"')
    expect(html).toContain('name="variant_id" value="v_tek"')
  })

  it("offers the stock alert for a variant out of stock, not the instalments", () => {
    const html = page({
      variants: [variant("v_yesil", "Yeşil", { available: false })],
      options: [{ id: "opt_renk", title: "Renk", values: ["Yeşil"] }],
    })
    expect(html).toContain('id="stok-bildirimi"')
    expect(html).not.toContain("Taksit seçenekleri")
    expect(html).toContain('href="#stok-bildirimi"')
  })

  it("asks the add-ons in the buy form, priced in words", () => {
    const html = page({
      addons: [
        {
          id: "gravur",
          kind: "text",
          label: "Namluya yazı",
          help: null,
          required: false,
          maxQuantity: 1,
          nonWithdrawable: true,
          price: "+35,00 TL",
          kurus: 3500,
          maxLength: 20,
          rules: "En çok 20 karakter.",
          choices: [],
        },
      ],
    })
    expect(html).toContain('name="addon_gravur"')
    expect(html).toContain('name="product_id" value="prod_1"')
    expect(html).toContain("+35,00 TL")
    expect(html).toContain("cayma hakkı kapsamı dışındadır")
  })

  it("asks a gift card's recipient instead", () => {
    const html = page({ giftCard: true })
    expect(html).toContain('name="recipient_email"')
    expect(html).toContain('name="message"')
  })

  it("says the withdrawal note before the purchase and the delivery facts", () => {
    const html = page({ withdrawalNote: "Bu ürün için cayma hakkı bulunmaz." })
    expect(html).toContain("Bu ürün için cayma hakkı bulunmaz.")
    expect(html).toContain(">Teslimat ve iade</h2>")
    expect(html).toContain("Aynı gün kargo")
    expect(html).toContain("WhatsApp&#x27;tan sor")
  })

  it("tabs the description and the ruled spec table, both panels in the first HTML", () => {
    const html = page()
    expect(html).toContain('role="tablist" aria-label="Ürün bilgileri"')
    expect(html).toMatch(
      /<button type="button" role="tab" id="aciklama-sekme" aria-selected="true" aria-controls="aciklama" tabindex="0"[^>]*>Ürün açıklaması<\/button>/
    )
    expect(html).toMatch(
      /<button type="button" role="tab" id="ozellikler-sekme" aria-selected="false" aria-controls="ozellikler" tabindex="-1"[^>]*>Ürün özellikleri<\/button>/
    )
    // The specs panel is closed by the stylesheet only with the script, never hidden in the HTML
    expect(html).toMatch(
      /<section id="ozellikler" role="tabpanel" aria-labelledby="ozellikler-sekme" tabindex="0" data-inactive=""/
    )
    expect(html).not.toMatch(/<section id="ozellikler"[^>]*hidden/)
    expect(html).toContain(
      '<h2 id="urun-ozellikleri" class="gf-info-head text-section">Ürün özellikleri</h2>'
    )
    expect(html).toContain("<h2>Namlu</h2><p>Elmax çelik namlu.</p>")
    expect(html).toMatch(/<th scope="rowgroup" colSpan="2"[^>]*>Ölçü ve ağırlık<\/th>/)
    expect(html).toMatch(/<th scope="row"[^>]*>Toplam boy<\/th><td[^>]*>21 cm<\/td>/)
  })

  it("draws no tabs with only one of the two", () => {
    const described = page({ specs: [], specGroups: [] })
    expect(described).not.toContain('role="tablist"')
    expect(described).toContain(
      '<h2 id="urun-aciklamasi" class="text-section">Ürün açıklaması</h2>'
    )
    const specified = page({ description: [], descriptionHtml: null })
    expect(specified).not.toContain('role="tablist"')
    expect(specified).toContain(
      '<h2 id="urun-ozellikleri" class="text-section">Ürün özellikleri</h2>'
    )
  })

  it("opens a long description at about half with its real toggle, a short one whole", () => {
    const long = page({ descriptionHtml: `<p>${"Elmax çelik namlu, el yapımı. ".repeat(40)}</p>` })
    expect(long).toContain('data-open="false"')
    expect(long).toMatch(
      /<button type="button" class="gf-btn gf-btn--quiet gf-btn--small gf-more-toggle self-start" aria-expanded="false" aria-controls="aciklama-metni">Devamını oku/
    )
    const short = page()
    expect(short).toContain('data-open="true"')
    expect(short).not.toContain("Devamını oku")
  })

  it("falls back to one flat spec table and the plain paragraphs", () => {
    const html = page({ specGroups: [], descriptionHtml: null })
    expect(html).toContain("<p>Düz metin açıklama.</p>")
    expect(html).not.toContain('scope="rowgroup"')
    expect(html).toContain(">Elmax</td>")
  })

  it("puts the reviews right after the tabs, then the questions and the related products", () => {
    const html = page()
    const at = (needle: string) => html.indexOf(needle)
    expect(at('role="tablist"')).toBeGreaterThan(at('id="sepet-formu"'))
    expect(at('id="degerlendirmeler"')).toBeGreaterThan(at('id="ozellikler"'))
    expect(at('id="sorular"')).toBeGreaterThan(at('id="degerlendirmeler"'))
    expect(at(">Benzer ürünler</h2>")).toBeGreaterThan(at('id="sorular"'))
  })

  it("shows the reviews with the spread and the photos, the questions with the shop's answer", () => {
    const html = page()
    expect(html).toContain('id="degerlendirmeler"')
    expect(html).toContain("5 yıldız: 1 değerlendirme")
    expect(html).toContain("Eline sağlık, tam anlatıldığı gibi.")
    expect(html).toContain('src="/media/yorum.jpg"')
    expect(html).toContain("Deri kılıfıyla gelir.")
    expect(html).toContain("Mağaza yanıtı")
    // A guest is offered the way to sign in, never a form
    expect(html).not.toContain('name="rating"')
    expect(html).toContain("Giriş yapın")
  })

  it("lets a signed-in customer rate with five real radios and ask a question", () => {
    const html = page({ signedIn: true })
    expect(html.match(/name="rating"/g)).toHaveLength(5)
    expect(html).toContain('name="photos"')
    expect(html).toContain('id="soru-metin"')
  })

  it("ends on the category's other products", () => {
    const html = page()
    expect(html).toContain(">Benzer ürünler</h2>")
    expect(html).toContain('href="/urun/mavi"')
  })
})
