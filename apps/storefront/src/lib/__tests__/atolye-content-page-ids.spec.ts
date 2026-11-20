import { describe, expect, it } from "vitest"
import type { FaqView } from "@qticaret/ui"
import {
  article,
  contact,
  contactSection,
  outline,
  page,
  payments,
  shipping,
} from "@/test/content-page"

/**
 * Two text sections of a kind on one content page (adr/0073 Ek 2026-11-19
 * (2) K2): the later one's fixed ids (its contents, its help, the ways to
 * reach the shop, the imprint, the form's fields, the facts' headings)
 * apart from the first's, each label still naming its own box; a page of
 * one text keeps its ids as they were (the preset lock keeps that page).
 */

/** Every id the page writes, in order. */
const ids = (html: string) => [...html.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1] ?? "")

/** Every id a label, a box or a field points at. */
const pointed = (html: string) =>
  [...html.matchAll(/\s(?:aria-labelledby|htmlFor|for)="([^"]*)"/g)].map((match) => match[1] ?? "")

const faq: FaqView = {
  intro: "",
  groups: [
    {
      id: "siparis",
      title: "Sipariş",
      lead: "",
      items: [{ question: "Ne zaman?", html: "<p>Yarın.</p>" }],
    },
    { id: "iade", title: "İade", lead: "", items: [{ question: "Nasıl?", html: "<p>Kolay.</p>" }] },
  ],
}

/** A group's anchor in a later text, as the page's shared anchors give it. */
const later = (group: FaqView["groups"][number]) => ({ ...group, id: `${group.id}-2` })

describe("the fixed ids of a content page's text sections", () => {
  it("keeps one text's ids as they were", () => {
    const html = page({ sections: [article({ outline }), contactSection(), payments, shipping] })
    for (const id of [
      "icindekiler",
      "bize-ulasin",
      "kunye",
      "iletisim-formu",
      "iletisim-ad",
      "odeme-yontemleri",
      "guvencelerimiz",
      "kargo-firmalari",
    ]) {
      expect(ids(html)).toContain(id)
    }
    expect(ids(html).filter((id) => id.includes("--"))).toEqual([])
  })

  it("gives two of a kind on one page ids of their own, each label naming its own box", () => {
    const html = page({
      sections: [
        article({ id: "bir", outline }),
        article({ id: "iki", outline }),
        article({ id: "sss1", faq, help: contact }),
        // Its groups' anchors as the storefront makes them, apart from the first's (`faqOf`)
        article({ id: "sss2", faq: { ...faq, groups: faq.groups.map(later) }, help: contact }),
        contactSection({ id: "ilt1" }),
        contactSection({ id: "ilt2" }),
        { ...payments, id: "odeme1" },
        { ...payments, id: "odeme2" },
        { ...shipping, id: "kargo1" },
        { ...shipping, id: "kargo2" },
      ],
    })
    const written = ids(html)
    expect(written.length).toBeGreaterThan(0)
    expect(new Set(written).size).toBe(written.length)
    for (const id of ["icindekiler", "yardim", "bize-ulasin", "kunye", "iletisim-ad"]) {
      expect(written).toContain(id)
      expect(written).toContain(`${id}--2`)
    }
    for (const id of [
      "odeme-yontemleri",
      "taksit-secenekleri",
      "guvencelerimiz",
      "kargo-firmalari",
    ]) {
      expect(written).toContain(`${id}--2`)
    }
    for (const target of pointed(html)) {
      expect(written).toContain(target)
    }
  })
})
