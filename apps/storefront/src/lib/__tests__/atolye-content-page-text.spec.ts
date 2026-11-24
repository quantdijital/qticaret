import { describe, expect, it } from "vitest"
import { FAQ_DEFAULTS } from "@qticaret/types"
import type { PageContactView, PageFaqView } from "@qticaret/ui"
import {
  article,
  contact,
  contactSection,
  outline,
  page,
  payments,
  shipping,
  textPage,
} from "@/test/content-page"

/**
 * A content page's own text sections in Atölye (adr/0073 Ek 2026-11-19
 * (2) K2, K8): the page's text (`article`) with an optional heading of its
 * own, the payment and shipping facts beside the text they follow and
 * across the page alone, the contact page's body as switched; each under
 * its own section mark (adr/0065 §4), the page's one h1 the head's.
 */

describe("the theme's page text (`article`)", () => {
  it("heads a titled text with an h2 under the page's one h1, its fields marked in the editor", () => {
    const html = textPage({ title: "Hikâyemiz", editor: true })
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('<h2 id="bolum-metin" data-qf="title">Hikâyemiz</h2>')
    expect(html).toContain('data-qf="body"')
    expect(textPage()).not.toContain("<h2")
    expect(textPage()).not.toContain("data-qf")
  })
})

describe("the theme's payment and shipping facts", () => {
  it("stands the facts right after a text beside it (7/5), the rates across the page under both", () => {
    const html = page({ sections: [article(), payments, shipping] })
    expect(html).toContain('<article class="min-w-0 lg:col-span-7">')
    expect(html).toContain("lg:sticky lg:top-(--gf-stick-top) lg:col-span-5 lg:self-start")
    // Each carries its own mark inside the text's
    expect(html).toMatch(
      /<div data-qs="metin"><div class="grid[\s\S]*data-qs="odeme"[\s\S]*data-qs="kargo"/
    )
    expect(html).toMatch(/<div class="min-w-0 pt-\(--space-xl\) lg:col-span-12"><section/)
    // A long text's contents give way to the facts
    expect(page({ sections: [article({ outline }), payments] })).not.toContain("İçindekiler")
  })

  it("draws the facts alone across the page, each in its own box", () => {
    const html = page({ sections: [payments] })
    expect(html).not.toContain("<article")
    expect(html).toContain('<div data-qs="odeme"><div class="flex flex-col gap-(--gap-columns)">')
    expect(html.match(/<table/g)).toHaveLength(1)
    const both = page({ sections: [shipping, article()] })
    // Facts before the text are not beside it
    expect(both).toContain('<article class="min-w-0 lg:col-span-8">')
    expect(both.indexOf('data-qs="kargo"')).toBeLessThan(both.indexOf('data-qs="metin"'))
  })

  it("puts the payment facts' mark on the rates when there are no ways to pay beside the text", () => {
    const rates = { ...payments, payments: { ...payments.payments, marks: [] } }
    const html = page({ sections: [article(), rates] })
    expect(html.match(/data-qs="odeme"/g)).toHaveLength(1)
    expect(html).toMatch(/lg:col-span-12"><div data-qs="odeme"><section/)
  })

  it("leaves the facts after a text of questions on their own", () => {
    const faq = { intro: "", groups: [{ id: "g", title: null, lead: "", items: [] }] }
    const html = page({ sections: [article({ faq, help: null }), shipping] })
    expect(html).not.toContain("lg:col-span-7")
    expect(html).toContain('data-qs="kargo"')
  })
})

describe("the theme's questions page (`faq` as `page`, adr/0073 Ek 2026-11-24 (2))", () => {
  const faq = {
    intro: "",
    groups: [
      {
        id: "kargo",
        title: "Kargo",
        lead: "",
        items: [
          { question: "Ne zaman?", html: "<p>Aynı gün.</p>" },
          { question: "Nereden?", html: "<p>İstanbul.</p>" },
        ],
      },
      {
        id: "odeme",
        title: "Ödeme",
        lead: "",
        items: [{ question: "Taksit?", html: "<ul><li>3 taksit</li></ul>" }],
      },
    ],
  }
  const section = (over: Partial<PageFaqView> = {}): PageFaqView => ({
    id: "metin",
    type: "faq",
    variant: "page",
    title: null,
    faq,
    help: contact,
    ...over,
  })

  it("draws the shop's own questions exactly as a text of questions was drawn", () => {
    const fromText = page({ sections: [article({ faq, help: contact })] })
    expect(page({ sections: [section()] })).toBe(fromText)
    expect(page({ sections: [section({ title: "Sorular" })] })).toBe(
      page({ sections: [article({ faq, help: contact, title: "Sorular" })] })
    )
    expect(page({ sections: [section({ settings: FAQ_DEFAULTS })] })).toBe(fromText)
  })

  it("keeps every answer in the HTML as native disclosures, the topics as links to the groups", () => {
    const html = page({ sections: [section()] })
    expect(html.match(/<details/g)).toHaveLength(3)
    expect(html).toContain("<summary")
    expect(html).toContain("<ul><li>3 taksit</li></ul>")
    expect(html).toContain('href="#kargo"')
    expect(html).toContain('<h2 id="odeme"')
    expect(html).not.toContain("<details open")
  })

  it("opens the first question and groups them as one when the shop asks", () => {
    const html = page({
      sections: [section({ settings: { open_first: "on", single_open: "on" } })],
    })
    expect(html.match(/<details[^>]* open=""/g)).toHaveLength(1)
    expect(html.match(/name="sss-metin"/g)).toHaveLength(3)
  })
})

describe("the theme's contact page (the `contact` section)", () => {
  const contactPage = (over: Partial<PageContactView> = {}) =>
    page({ title: "İletişim", sections: [contactSection(over)] })

  it("draws the contact section as the contact page's body, under its mark", () => {
    const html = contactPage()
    expect(html).toContain('<div data-qs="iletisim"><div class="grid gap-(--gap-columns)')
    expect(html).toContain("<p>Bize yazın.</p>")
    // Switched off: no form, no imprint
    const bare = contactPage({ form: null, identity: [] })
    expect(bare).not.toContain('name="email"')
    expect(bare).not.toContain('id="kunye"')
    expect(bare).toContain('id="bize-ulasin"')
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

  it("sets the imprint as one compact card across the page under the form, its facts side by side", () => {
    const html = contactPage()
    // Owner 2026-11-05: the long list "ekranı çok uzatıyor"
    expect(html).toMatch(/<div class="min-w-0 lg:col-span-12"><section aria-labelledby="kunye"/)
    expect(html).toMatch(/<dl class="grid [^"]*sm:grid-cols-2[^"]*lg:grid-cols-3/)
    expect(html).toMatch(/<dt class="text-sm text-text-3">MERSİS numarası<\/dt>/)
    // Without a form the card stands beside the stage, two to a row
    const alone = contactPage({ form: null, identity: [{ label: "Unvan", value: "Örnek" }] })
    expect(alone).toMatch(/<div class="min-w-0 lg:col-span-7"><section aria-labelledby="kunye"/)
    expect(alone).not.toContain("lg:grid-cols-3")
  })
})
