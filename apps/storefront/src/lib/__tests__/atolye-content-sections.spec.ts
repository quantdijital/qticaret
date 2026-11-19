import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ContentPageView, HomeSectionView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Grafit theme's content pages with their own sections (adr/0073 §2,
 * S3): the page's head, the sections above its text, the text with its
 * role's parts, the sections below it, as siblings; one h1, the head's. A
 * page with none is drawn as before (the preset lock keeps that whole page:
 * `preset-lock/fixture-content-pages`).
 */

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

const story: HomeSectionView = {
  id: "ustmetin",
  type: "rich_text",
  title: "Neye inanıyoruz",
  html: "<h3>Misyonumuz</h3><p>Güvenilir bıçaklar.</p>",
}

const help: HomeSectionView = {
  id: "altyardim",
  type: "help",
  title: "Hangi bıçak size uygun?",
  text: "Bize yazın.",
  contact: {
    email: "bilgi@example.com",
    phone: null,
    phoneHref: null,
    whatsappHref: null,
    address: null,
    hours: [],
    mapHref: null,
  },
}

const badges: HomeSectionView = {
  id: "altvaat",
  type: "trust_badges",
  badges: [{ icon: "truck", title: "Ücretsiz kargo", text: "1.500 TL ve üzeri" }],
  variant: "lined",
}

const contact: Partial<ContentPageView> = {
  title: "İletişim",
  html: "<p>Bize yazın.</p>",
  contact: {
    email: "bilgi@example.com",
    phone: "0532 000 00 00",
    phoneHref: "tel:+905320000000",
    whatsappHref: null,
    address: "Örnek Mah. 1. Sok. No: 1, Denizli",
    hours: [],
    mapHref: null,
  },
  identity: [{ label: "Unvan", value: "Örnek Atölye Ltd. Şti." }],
  contactForm: {
    subjects: [{ value: "order", label: "Siparişim" }],
    name: null,
    email: null,
    privacyPath: null,
  },
}

/** Where each marker first stands in the page, in the order given; -1 for one missing. */
const at = (html: string, ...markers: string[]) => markers.map((marker) => html.indexOf(marker))

describe("the theme's content page with its own sections (adr/0073)", () => {
  it("draws a page whose sections are both empty as a page with none", () => {
    for (const over of [{}, contact, { outline: [] }]) {
      expect(page({ ...over, sections: { top: [], bottom: [] } })).toBe(page(over))
    }
  })

  it("sets the head, the sections above, the text and the sections below as siblings", () => {
    const html = page({ sections: { top: [story], bottom: [help] } })
    const [h1 = -1, above = -1, text = -1, below = -1] = at(
      html,
      "<h1",
      'data-qs="ustmetin"',
      "<p>Atölye mağazası.</p>",
      'data-qs="altyardim"'
    )
    expect(h1).toBeGreaterThan(-1)
    expect(above).toBeGreaterThan(h1)
    expect(text).toBeGreaterThan(above)
    expect(below).toBeGreaterThan(text)
    // Each section in its own container: none inside the head's or the text's
    expect(
      html.startsWith('<div class="mx-auto w-full max-w-(--container) px-(--gutter) pt-6')
    ).toBe(true)
    expect(html).toMatch(/<\/div><div data-qs="ustmetin">/)
    expect(html).toMatch(/<\/div><div data-qs="altyardim">/)
  })

  it("prints one h1, the head's; the sections' titles are h2s", () => {
    const html = page({ sections: { top: [story], bottom: [help, badges] } })
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>Hakkımızda<\/h1>/)
    expect(html).toMatch(/<h2[^>]*>Neye inanıyoruz<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>Hangi bıçak size uygun\?<\/h2>/)
  })

  it("keeps the contact page's body as it is, the sections above and below it", () => {
    const plain = page(contact)
    // The contact body as drawn today: everything in the one container after the head
    const start = plain.indexOf('<div class="grid gap-(--gap-columns) lg:grid-cols-12')
    const body = plain.slice(start, plain.length - "</div>".length)
    expect(start).toBeGreaterThan(-1)
    const html = page({ ...contact, sections: { top: [badges], bottom: [help] } })
    expect(html).toContain(body)
    expect(html.match(/id="iletisim-formu"/g)).toHaveLength(1)
    expect(html.match(/<h1/g)).toHaveLength(1)
    const [above = -1, form = -1, below = -1] = at(
      html,
      'data-qs="altvaat"',
      'id="iletisim-formu"',
      'data-qs="altyardim"'
    )
    expect(form).toBeGreaterThan(above)
    expect(below).toBeGreaterThan(form)
  })

  it("draws no text area on a page built of sections alone, the head and the sections kept", () => {
    for (const html of ["", "<p></p>", " <p> </p> "]) {
      const drawn = page({ html, sections: { top: [], bottom: [story, help] } })
      expect(drawn).not.toContain("gf-prose")
      expect(drawn).not.toContain("<article")
      expect(drawn.match(/<h1/g)).toHaveLength(1)
      expect(drawn).toContain('data-qs="ustmetin"')
      expect(drawn).toContain('data-qs="altyardim"')
    }
    // Without sections an empty page is drawn as before, its text area there
    expect(page({ html: "" })).toContain("<article")
  })

  it("keeps the role's parts of a page with no text: the shipping page's facts", () => {
    const html = page({
      html: "",
      shipping: {
        carriers: [],
        promises: [{ icon: "truck", title: "Aynı gün kargo", text: null }],
      },
      sections: { top: [], bottom: [help] },
    })
    expect(html).toContain("Aynı gün kargo")
  })

  it("draws a post as before: a post takes no sections", () => {
    const post = {
      post: { date: null, dateTime: null, reading: "1 dk okuma", author: null },
    }
    expect(page({ ...post, sections: { top: [story], bottom: [help] } })).toBe(page(post))
  })
})
