import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ContactView, ContentPageView, ImageView, ProductCardView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Grafit theme's content pages (design.md § İçerik sayfaları): the
 * shop's own page as its text in a reading measure (a cover on a graphite
 * stage, contents beside a long text, the payment and shipping pages'
 * live facts), the contact page, a page of questions as disclosures, and
 * a blog post with its facts, products, tags, share links and next reads.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1280,
  height: 800,
  sources: { avif: null, webp: `/media/${name}-640.webp 640w` },
})

const contact: ContactView = {
  email: "bilgi@example.com",
  phone: "0532 000 00 00",
  phoneHref: "tel:+905320000000",
  whatsappHref: "https://wa.me/905320000000",
  address: "Örnek Mah. 1. Sok. No: 1, Denizli",
  hours: [{ days: "Pazartesi – Cuma", hours: "08:00 – 19:00" }],
  mapHref: "https://maps.example.com/atolye",
}

const view = (over: Partial<ContentPageView> = {}): ContentPageView => ({
  title: "Hakkımızda",
  breadcrumbs: [
    { label: "Ana sayfa", path: "/" },
    { label: "Hakkımızda", path: null },
  ],
  html: "<p>Atölye mağazası.</p>",
  publishedAt: null,
  ...over,
})

const page = (over: Partial<ContentPageView> = {}) =>
  renderPage(atolyeTheme, "ContentPage", {
    view: view(over),
    actions: { sendContact: () => Promise.resolve({ ok: true, error: null, challenge: null }) },
  })

const outline = [
  { id: "bir", label: "Bir" },
  { id: "iki", label: "İki" },
  { id: "uc", label: "Üç" },
]

describe("the theme's content page", () => {
  it("prints the shop's text in the reading measure under the one h1", () => {
    const html = page()
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('class="gf-prose ')
    expect(html).toContain("<p>Atölye mağazası.</p>")
    expect(html).not.toContain("gf-stage")
  })

  it("sets the title on a graphite stage beside the page's own cover, loaded at once", () => {
    const html = page({ image: picture("kapak") })
    expect(html).toMatch(/class="gf-stage grid[^"]*"/)
    expect(html).toContain('fetchPriority="high"')
    expect(html).toMatch(/<h1 class="text-display">Hakkımızda<\/h1>/)
  })

  it("lists a long text's headings twice (closed on a phone, beside it from 1024 px), a short one's never", () => {
    expect(page({ outline }).match(/href="#iki"/g)).toHaveLength(2)
    expect(page({ outline }).match(/<details/g)).toHaveLength(1)
    expect(page({ outline: outline.slice(0, 2) })).not.toContain("İçindekiler")
  })

  it("sets a long text in the post's reading column, its contents on the left from 1024 px", () => {
    const html = page({ outline })
    expect(html).toContain("lg:grid-cols-[minmax(13rem,1fr)_minmax(0,34rem)_minmax(0,1fr)]")
    expect(html).toMatch(/<aside[^>]*class="[^"]*lg:col-start-1 lg:row-start-1/)
    expect(html).toMatch(/<article class="min-w-0 lg:col-start-2">/)
  })

  it("draws the payment page's ways to pay and one table of the families' rates", () => {
    const html = page({
      payments: {
        marks: [
          { key: "visa", label: "Visa", logo: { src: "/marks/visa.png", width: 208, height: 68 } },
          { key: "bank_transfer", label: "Havale / EFT", logo: null },
        ],
        installments: [
          { family: "World", options: [{ count: 2, rate: "Vade farksız", free: true }] },
          {
            family: "Bonus",
            options: [
              { count: 2, rate: "%4,35", free: false },
              { count: 3, rate: "%5,79", free: false },
            ],
          },
        ],
        maxInstallments: 3,
      },
    })
    expect(html).toContain('alt="Visa"')
    expect(html).toContain("Havale / EFT")
    expect(html.match(/<table/g)).toHaveLength(1)
    expect(html).toContain('<th scope="col" class="px-4 py-3 text-right font-extrabold">World</th>')
    expect(html).toContain(">3 taksit</th>")
    expect(html).toContain("%5,79")
    // World offers no third installment: the cell says so
    expect(html).toContain(">Yok</td>")
    expect(html).toContain('role="region"')
    expect(html).toContain("en çok 3 taksit")
  })

  it("draws the shipping page's promises and its carriers' marks", () => {
    const html = page({
      shipping: {
        carriers: [{ key: "aras", label: "Aras Kargo", logo: null }],
        promises: [{ icon: "truck", title: "Ücretsiz kargo", text: "1.500 TL ve üzeri" }],
      },
    })
    expect(html).toContain("Kargo firmalarımız")
    expect(html).toContain("Aras Kargo")
    expect(html).toContain("Ücretsiz kargo")
  })
})

describe("the theme's contact page", () => {
  const contactPage = () =>
    page({
      title: "İletişim",
      contact,
      identity: [
        { label: "Unvan", value: "Örnek Atölye Ltd. Şti." },
        { label: "MERSİS numarası", value: "0123456789000015" },
      ],
      contactForm: {
        subjects: [{ value: "order", label: "Siparişim" }],
        name: null,
        email: null,
        privacyPath: "/yasal/kvkk-aydinlatma-metni",
      },
    })

  it("puts the ways to reach the shop on a graphite stage: WhatsApp, phone, e-mail, map, hours", () => {
    const html = contactPage()
    expect(html).toContain('href="https://wa.me/905320000000"')
    expect(html).toContain('href="tel:+905320000000"')
    expect(html).toContain('href="mailto:bilgi@example.com"')
    expect(html).toContain('href="https://maps.example.com/atolye"')
    expect(html).toContain("08:00 – 19:00")
  })

  it("prints the imprint once, each fact set, and the form with its labelled fields", () => {
    const html = contactPage()
    expect(html.match(/id="kunye"/g)).toHaveLength(1)
    expect(html).toContain("0123456789000015")
    for (const name of ["name", "email", "phone", "subject", "order_number", "body"]) {
      expect(html).toContain(`name="${name}"`)
    }
    expect(html).toContain('for="iletisim-mesaj"')
    expect(html).toContain('href="/yasal/kvkk-aydinlatma-metni"')
  })
})

describe("the theme's questions page", () => {
  const faqPage = () =>
    page({
      title: "Sık Sorulan Sorular",
      faq: {
        intro: "<p>Giriş.</p>",
        groups: [
          {
            id: "kargo",
            title: "Kargo",
            lead: "",
            items: [{ question: "Ne zaman gelir?", html: "<p>1-4 gün.</p>" }],
          },
          {
            id: "iade",
            title: "İade",
            lead: "<p>Kısa not.</p>",
            items: [{ question: "Süre ne?", html: "<p>14 gün.</p>" }],
          },
        ],
      },
      help: contact,
    })

  it("draws each group under its h2 and each question as a closed disclosure with its answer in the HTML", () => {
    const html = faqPage()
    expect(html).toContain('<h2 id="kargo"')
    expect(html.match(/<details/g)).toHaveLength(2)
    expect(html).not.toContain("<details open")
    expect(html).toContain("<p>1-4 gün.</p>")
    expect(html).toContain("<p>Kısa not.</p>")
  })

  it("names the topics as pills to their groups and offers the ways to reach the shop", () => {
    const html = faqPage()
    expect(html).toContain('href="#kargo"')
    expect(html).toContain('href="#iade"')
    expect(html).toContain("Sorunuzun yanıtı burada yok mu?")
    expect(html).toContain('href="https://wa.me/905320000000"')
  })
})

const card = (id: string): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: picture(id),
  price: { current: "1.299,90 TL", before: null, from: false, discount: null },
  available: true,
})

describe("the theme's blog post", () => {
  const post = (over: Partial<ContentPageView> = {}) =>
    page({
      title: "Elmax Çelik Nedir?",
      breadcrumbs: [
        { label: "Ana sayfa", path: "/" },
        { label: "Blog", path: "/blog" },
        { label: "Elmax Çelik Nedir?", path: null },
      ],
      category: { label: "Çelikler", path: "/blog/kategori/celikler" },
      tags: [{ label: "Elmax", path: "/blog/etiket/elmax" }],
      image: picture("kapak"),
      post: {
        date: "30 Ekim 2026",
        dateTime: "2026-10-30T09:00:00.000Z",
        reading: "9 dk okuma",
        author: "Usta",
      },
      outline,
      products: [card("prod_a")],
      related: [
        {
          title: "N690 Çelik",
          path: "/blog/n690",
          excerpt: "N690 nedir?",
          image: null,
          date: "1 Ekim 2026",
          dateTime: "2026-10-01T09:00:00.000Z",
          reading: "5 dk okuma",
          category: null,
        },
      ],
      share: [{ label: "WhatsApp", href: "https://wa.me/?text=x" }],
      ...over,
    })

  it("opens with the category pill, the title, who wrote it, when and how long, without a dot between", () => {
    const html = post()
    expect(html).toContain('href="/blog/kategori/celikler"')
    expect(html).toMatch(/<h1 class="[^"]*">Elmax Çelik Nedir\?<\/h1>/)
    expect(html).toContain("Yazan: Usta")
    expect(html).toContain('<time dateTime="2026-10-30T09:00:00.000Z">30 Ekim 2026</time>')
    expect(html).not.toContain(" · ")
  })

  it("sets the title, the cover and the text in one reading column, never across the page", () => {
    const html = post()
    const column = "sm:col-start-2"
    expect(html).toContain("sm:grid-cols-[minmax(0,1fr)_minmax(0,32rem)_minmax(0,1fr)]")
    expect(html).toMatch(new RegExp(`<header class="[^"]*${column}`))
    expect(html).toMatch(new RegExp(`<article class="min-w-0 ${column}">`))
    expect(html).toMatch(new RegExp(`class="gf-stage [^"]*${column}"`))
    expect(html).toContain('sizes="(min-width: 1024px) 544px, (min-width: 640px) 512px, 100vw"')
    expect(html).not.toContain("text-center")
    // The contents stand beside the title, the cover and the text alike
    expect(html).toMatch(/<aside[^>]*class="[^"]*lg:col-start-1 lg:row-start-1 lg:row-span-3/)
    expect(post({ image: null })).toMatch(/<aside[^>]*class="[^"]*lg:row-span-2/)
  })

  it("closes with the tags, the share links in a new tab, the products and the next reads", () => {
    const html = post()
    expect(html).toContain('href="/blog/etiket/elmax"')
    expect(html).toContain('aria-label="WhatsApp ile paylaş (yeni sekmede açılır)"')
    expect(html).toContain("Yazıda geçen ürünler")
    expect(html).toContain('href="/urun/prod_a"')
    expect(html).toContain("Bunları da okuyun")
    expect(html).toMatch(/<h3 class="[^"]*"><a href="\/blog\/n690"/)
  })

  it("leaves out what the post does not have", () => {
    const html = post({ products: [], related: [], share: [], tags: [] })
    expect(html).not.toContain("Yazıda geçen ürünler")
    expect(html).not.toContain("Bunları da okuyun")
    expect(html).not.toContain("Bu yazıyı paylaşın")
  })
})
