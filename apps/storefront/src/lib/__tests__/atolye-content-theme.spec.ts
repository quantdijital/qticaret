import { describe, expect, it } from "vitest"
import type { ContentPageView, ProductCardView } from "@qticaret/ui"
import {
  article,
  contact,
  outline,
  page,
  payments,
  picture,
  shipping,
  textPage,
} from "@/test/content-page"

/**
 * The Grafit theme's content pages (design.md § İçerik sayfaları): the
 * shop's own page as its text in a reading measure (a cover on a graphite
 * stage, contents beside a long text, the payment and shipping pages'
 * live facts), a page of questions as disclosures, and a blog post with
 * its facts, products, tags, share links and next reads. The page's text
 * sections on their own (a titled text, the facts, the contact page):
 * `atolye-content-page-text.spec.ts`.
 */

describe("the theme's content page", () => {
  it("prints the shop's text in the reading measure under the one h1", () => {
    for (const html of [textPage(), page()]) {
      expect(html.match(/<h1/g)).toHaveLength(1)
      expect(html).toContain('class="gf-prose ')
      expect(html).toContain("<p>Atölye mağazası.</p>")
      expect(html).toContain('<article class="min-w-0 lg:col-span-8">')
      expect(html).not.toContain("gf-stage")
    }
    // The text section carries its mark; a page from before sections (`html` alone) none
    expect(textPage()).toContain('<div data-qs="metin"><div class="grid gap-8')
    expect(page()).not.toContain("data-qs")
  })

  it("sets the title on a graphite stage beside the page's own cover, loaded at once", () => {
    const html = page({ image: picture("kapak") })
    expect(html).toMatch(/class="gf-stage grid[^"]*"/)
    expect(html).toContain('fetchPriority="high"')
    expect(html).toMatch(/<h1 class="text-display">Hakkımızda<\/h1>/)
  })

  it("lists a long text's headings twice (closed on a phone, beside it from 1024 px), a short one's never", () => {
    expect(textPage({ outline }).match(/href="#iki"/g)).toHaveLength(2)
    expect(textPage({ outline }).match(/<details/g)).toHaveLength(1)
    expect(textPage({ outline: outline.slice(0, 2) })).not.toContain("İçindekiler")
  })

  it("sets a long text in the post's reading column, its contents on the left from 1024 px", () => {
    const html = textPage({ outline })
    // About 86 letters a line on a computer (owner 2026-11-05: 34rem was "aşırı dar")
    expect(html).toContain("lg:grid-cols-[minmax(14rem,1fr)_minmax(0,46rem)_minmax(0,1fr)]")
    expect(html).toContain("xl:grid-cols-[minmax(16rem,1fr)_minmax(0,46rem)_minmax(0,1fr)]")
    expect(html).not.toContain("34rem")
    expect(html).toMatch(/<aside[^>]*class="[^"]*lg:col-start-1 lg:row-start-1/)
    expect(html).toMatch(/<article class="min-w-0 lg:col-start-2">/)
  })

  it("draws the payment page's ways to pay and one table of the families' rates", () => {
    const html = page({ sections: [article(), payments] })
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
    const html = page({ sections: [article(), shipping] })
    expect(html).toContain("Kargo firmalarımız")
    expect(html).toContain("Aras Kargo")
    expect(html).toContain("Ücretsiz kargo")
  })
})

describe("the theme's questions page", () => {
  const faqPage = () =>
    textPage(
      {
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
      },
      { title: "Sık Sorulan Sorular" }
    )

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
    expect(html).toContain("lg:grid-cols-[minmax(14rem,1fr)_minmax(0,46rem)_minmax(0,1fr)]")
    expect(html).toMatch(new RegExp(`<header class="[^"]*${column}`))
    expect(html).toMatch(new RegExp(`<article class="min-w-0 ${column}">`))
    expect(html).toMatch(new RegExp(`class="gf-stage [^"]*${column}"`))
    expect(html).toContain('sizes="(min-width: 1024px) 736px, (min-width: 640px) 512px, 100vw"')
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
