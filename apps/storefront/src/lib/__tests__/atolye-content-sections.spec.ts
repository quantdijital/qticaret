import { describe, expect, it } from "vitest"
import type { HomeSectionView } from "@qticaret/ui"
import { article, contactSection, page, shipping } from "@/test/content-page"

/**
 * The Grafit theme's content pages as one list of sections (adr/0073 Ek
 * 2026-11-19 (2) K8): the page's head, then its sections in the shop's
 * order, its own text sections among them; one h1, the head's. The text
 * sections that open the page stand in the head's container (a page of
 * its text alone is drawn as before: the preset lock keeps that whole
 * page, `preset-lock/fixture-content-pages`); a later run of them in a
 * container of its own; the home page's types each in their own.
 */

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

const HEAD = '<div class="mx-auto w-full max-w-(--container) px-(--gutter)'

/** Where each marker first stands in the page, in the order given; -1 for one missing. */
const at = (html: string, ...markers: string[]) => markers.map((marker) => html.indexOf(marker))

describe("the theme's content page as one list of sections (adr/0073 Ek 2026-11-19 (2))", () => {
  it("sets a text that opens the page in the head's container, the sections after it on their own", () => {
    const html = page({ sections: [article(), help] })
    expect(html.startsWith(`${HEAD} flex flex-col gap-8 pt-6 lg:gap-12 lg:pt-10">`)).toBe(true)
    // The text's box inside the head's container, the help after it closes
    expect(html).toMatch(
      /<\/nav>[\s\S]*<div data-qs="metin">[\s\S]*<\/div><\/div><div data-qs="altyardim">/
    )
  })

  it("sets the head, the sections before the text, the text and the sections after as siblings", () => {
    const html = page({ sections: [story, article(), help] })
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
    // The head alone in its container; the text in one of its own, as far below as in the head's
    expect(html.startsWith(`${HEAD} pt-6 lg:pt-10">`)).toBe(true)
    expect(html).toMatch(/<\/div><div data-qs="ustmetin">/)
    expect(html).toContain(`${HEAD} pt-8 lg:pt-12"><div data-qs="metin">`)
    expect(html).toMatch(/<\/div><div data-qs="altyardim">/)
  })

  it("spaces a later run of text sections as the head's container spaces them", () => {
    const html = page({ sections: [story, article(), contactSection()] })
    expect(html).toContain(
      `${HEAD} flex flex-col gap-8 pt-8 lg:gap-12 lg:pt-12"><div data-qs="metin">`
    )
    // A text with the facts beside it is one part: one box in the container
    const paired = page({ sections: [story, article(), shipping] })
    expect(paired).toContain(`${HEAD} pt-8 lg:pt-12"><div data-qs="metin">`)
  })

  it("prints one h1, the head's; the sections' titles are h2s", () => {
    const html = page({ sections: [story, article({ title: "Biz kimiz" }), help, badges] })
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>Hakkımızda<\/h1>/)
    expect(html).toMatch(/<h2[^>]*>Neye inanıyoruz<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>Biz kimiz<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>Hangi bıçak size uygun\?<\/h2>/)
  })

  it("keeps the contact page's body as it is wherever it stands, the sections around it", () => {
    const plain = page({ title: "İletişim", sections: [contactSection()] })
    const start = plain.indexOf('<div class="grid gap-(--gap-columns) lg:grid-cols-12')
    const end = plain.lastIndexOf("</div></div>")
    expect(start).toBeGreaterThan(-1)
    const body = plain.slice(start, end)
    const html = page({ title: "İletişim", sections: [badges, contactSection(), help] })
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

  it("draws no text area on a page without text sections, the head and the sections kept", () => {
    for (const sections of [[], [story, help]]) {
      const drawn = page({ html: "<p>Ayna.</p>", sections })
      expect(drawn).not.toContain("gf-prose")
      expect(drawn).not.toContain("<article")
      expect(drawn.match(/<h1/g)).toHaveLength(1)
    }
    expect(page({ sections: [story, help] })).toContain('data-qs="altyardim"')
  })

  it("draws a post as before: a post takes no sections", () => {
    const post = {
      post: { date: null, dateTime: null, reading: "1 dk okuma", author: null },
    }
    expect(page({ ...post, sections: [story, help] })).toBe(page(post))
  })
})
