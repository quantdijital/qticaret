import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { BANNER_DEFAULTS } from "@qticaret/types/section-banner"
import { MARQUEE_DEFAULTS } from "@qticaret/types/section-marquee"
import type { HomeSectionView, ImageView, PlaceOrderResult, ShopView } from "@qticaret/ui"
import { renderPage, shopFixture } from "@/test/theme-render"

/**
 * The editor's field marks on the rest of Atölye's sections (adr/0065 §9,
 * Faz 2b): questions and answers, help, newsletter, the shop's text, the
 * close-up, trust badges, the picture band, the scrolling strip, a shelf's
 * pills, a columns rail's lists, price bands; in the frame the header
 * strip, the catalog header and the footer's newsletter. Each row takes
 * its place in the design. Without the editor's flag nothing is printed.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1600,
  height: 900,
  sources: { avif: null, webp: null },
})

const product = {
  id: "p1",
  title: "Şam çeliği hançer",
  path: "/urun/hancer",
  brand: null,
  image: picture("hancer"),
  price: { current: "3.850,00 TL", before: null, from: false, discount: null },
  available: true,
}

const subscribe = (): Promise<PlaceOrderResult> => Promise.resolve({ ok: true } as PlaceOrderResult)

const rail = (id: string, title: string) => ({
  id,
  type: "products" as const,
  title,
  products: [product],
  more: null,
  empty: "Yok",
})

/** Every section this spec looks at, each marked when `editor`. */
function sections(editor: boolean): HomeSectionView[] {
  const flag = editor ? { editor: true as const } : {}
  const list: HomeSectionView[] = [
    {
      id: "sss1",
      type: "faq",
      title: "Sorular",
      items: [
        { question: "Kargo?", answer: "Aynı gün." },
        { question: "İade?", answer: "14 gün." },
      ],
    },
    { id: "yardim1", type: "brands", title: "Ayırıcı", brands: [{ label: "A", path: "/a" }] },
    {
      id: "yardim2",
      type: "help",
      title: "Soru sorun",
      text: "Yazın.",
      contact: shopFixture().contact,
    },
    { id: "bulten1", type: "newsletter", title: "Bülten", text: "İzin metni", privacyPath: null },
    { id: "metin1", type: "rich_text", title: "Hikâyemiz", html: "<p>Atölye</p>" },
    {
      id: "yakin1",
      type: "featured_product",
      title: "Haftanın bıçağı",
      text: "Ustanın elinden.",
      product,
      subtitle: null,
      images: [picture("hancer")],
      facts: [],
      specGroups: [],
    },
    {
      id: "guven1",
      type: "trust_badges",
      variant: "strip",
      badges: [
        { icon: "truck", title: "Aynı gün", text: "Kargo" },
        { icon: "refresh", title: "İade", text: null },
      ],
    },
    {
      id: "bant1",
      type: "banner",
      ...BANNER_DEFAULTS,
      slides: [
        {
          image: picture("kis"),
          mobileImage: null,
          heading: "Kış",
          text: "İndirim",
          // The design's first button was broken: the second moved up
          link: { label: "İkinci", path: "/b" },
          secondLink: null,
          secondFirst: true,
          tone: "light",
        },
      ],
    },
    {
      id: "kayan1",
      type: "marquee",
      ...MARQUEE_DEFAULTS,
      items: [{ icon: null, text: "Ücretsiz kargo", subtext: "500 TL üstü", link: null }],
    },
    rail("raf1", "Yeni"),
    rail("raf2", "Çok satan"),
    { id: "ayrac", type: "brands", title: "Ayraç", brands: [{ label: "B", path: "/b" }] },
    {
      ...rail("sutun1", "Birinci"),
      variant: "columns",
      // Its first list had nothing to show: the second is the design's 1
      lists: [{ id: "sutun1-1", title: "İkinci liste", products: [product], at: 1 }],
    },
    {
      id: "bantlar1",
      type: "price_bands",
      title: "Fiyatlar",
      bands: [{ label: "1.000 TL altı", text: "Başlangıç", path: "/m", products: [], at: 1 }],
    },
  ]
  return list.map((section) => ({ ...section, ...flag }))
}

const home = (editor: boolean) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections: sections(editor) }, subscribe })

const marks = (html: string) => [...html.matchAll(/data-qf="([^"]*)"/g)].map((match) => match[1])

const frame = (shop: ShopView) =>
  renderPage(atolyeTheme, "Layout", {
    shop,
    children: createElement("p", null, "Sayfa"),
    saveCookies: () => Promise.resolve(),
    subscribe,
  })

describe("the field marks on Atölye's other sections", () => {
  it("print nothing on a live page", () => {
    expect(home(false)).not.toContain("data-qf")
  })

  it("mark each section's words, rows by their place in the design", () => {
    const found = marks(home(true))
    for (const key of [
      "title",
      "items.0.question",
      "items.1.answer",
      "text",
      "body",
      "badges.0.title",
      "badges.0.text",
      "badges.1.title",
      "slides.0.image",
      "slides.0.heading",
      "slides.0.text",
      "slides.0.second_link",
      "items.0.text",
      "items.0.subtext",
      "tabs.1.2",
      "lists.0.title",
      "bands.1.label",
      "bands.1.text",
    ]) {
      expect(found).toContain(key)
    }
    // A moved button, a left-out list or band: never the drawn place
    expect(found).not.toContain("slides.0.link")
    expect(found).not.toContain("bands.0.label")
    expect(found).not.toContain("badges.1.text")
  })

  it("mark a FAQ row and a shelf's pills on their own elements", () => {
    const html = home(true)
    expect(html).toMatch(/<summary[^>]*data-qf="items\.1\.question"[^>]*>İade\?/)
    expect(html).toMatch(/<label class="gf-tab" data-qf="title">.*?Yeni<\/label>/)
    expect(html).toMatch(/<label class="gf-tab" data-qf="tabs\.1\.2">.*?Çok satan<\/label>/)
  })

  it("mark every round of the scrolling strip, its copies hidden but under the pointer", () => {
    const strip = (editor: boolean) => {
      const html = renderPage(atolyeTheme, "HomePage", {
        view: {
          sections: [
            {
              id: "kayan2",
              type: "marquee",
              ...MARQUEE_DEFAULTS,
              items: [
                {
                  icon: null,
                  text: "Hızlı kargo",
                  subtext: null,
                  link: { label: "Kargo", path: "/kargo" },
                },
              ],
              ...(editor ? { editor: true as const } : {}),
            },
          ],
        },
        subscribe,
      })
      return html.slice(html.indexOf("<section"), html.lastIndexOf("</section>"))
    }
    const live = strip(false)
    const preview = strip(true)
    const copies = live.match(/data-part="item"/g)?.length ?? 0
    expect(copies).toBeGreaterThan(2)
    // In the preview: each round marked, nothing inert, the copies still hidden, one link only
    expect(marks(preview).filter((key) => key === "items.0.text")).toHaveLength(copies)
    expect(preview).not.toContain("inert")
    expect(preview).toContain('aria-hidden="true"')
    expect(preview.match(/<a /g)).toHaveLength(1)
    // On a live page the copies stay inert, their links drawn
    expect(live).toContain("inert")
    expect(live.match(/<a /g)).toHaveLength(copies)
  })
})

describe("the field marks in Atölye's frame", () => {
  const strip = {
    id: "ustserit",
    type: "marquee" as const,
    ...MARQUEE_DEFAULTS,
    items: [{ icon: null, text: "Kargo bedava", subtext: null, link: null }],
  }
  const catalog = {
    searchPlaceholder: "Bıçak ara",
    searchLabel: false,
    accountText: false,
    cartTotal: false,
    highlight: { label: "Kampanya", path: "/kampanya" },
    utilityBar: false,
    phone: false,
    categories: [],
    menuGround: "stage" as const,
  }
  const shop = (editor: boolean) =>
    shopFixture({
      marquee: strip,
      headerBar: { id: "mainheader", variant: "catalog", sticky: true, catalog },
      newsletter: { title: "Bülten", text: "İzin", ...(editor ? { mark: "altbulten" } : {}) },
      ...(editor ? { editor: true as const } : {}),
    })

  it("print nothing on a live page", () => {
    const html = frame(shop(false))
    expect(html).not.toContain("data-qf")
    expect(html).not.toContain('data-qs="ustserit"')
    expect(html).not.toContain('data-qs="altbulten"')
  })

  it("mark the header strip, the catalog header and the footer's newsletter in the preview", () => {
    const html = frame(shop(true))
    expect(html).toContain('data-qs="ustserit"')
    expect(html).toContain('data-qs="altbulten"')
    const found = marks(html)
    for (const key of ["items.0.text", "search_placeholder", "highlight_link", "title", "text"]) {
      expect(found).toContain(key)
    }
  })
})
