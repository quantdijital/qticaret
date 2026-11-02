import { describe, expect, it } from "vitest"
import type { HomeSectionView } from "@qticaret/ui"
import { faqJsonLd } from "../faq"
import { scriptSafeJson } from "../JsonLd"

const faq = (id: string, items: { question: string; answer: string }[]): HomeSectionView => ({
  id,
  type: "faq",
  title: null,
  items,
})

describe("faqJsonLd", () => {
  it("writes one FAQPage for every FAQ on the page, a question asked twice kept once", () => {
    const blocks = faqJsonLd([
      faq("a", [{ question: "İade süresi?", answer: "14 gün." }]),
      { id: "metin", type: "rich_text", title: null, html: "<p>x</p>" },
      faq("b", [
        { question: "iade süresi?", answer: "Başka cevap." },
        { question: "Kargo?", answer: "Ücretsiz." },
      ]),
    ])

    expect(blocks).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "İade süresi?",
            acceptedAnswer: { "@type": "Answer", text: "14 gün." },
          },
          {
            "@type": "Question",
            name: "Kargo?",
            acceptedAnswer: { "@type": "Answer", text: "Ücretsiz." },
          },
        ],
      },
    ])
  })

  it("writes nothing on a page without a FAQ", () => {
    expect(faqJsonLd([{ id: "x", type: "trust_badges", badges: [] }])).toEqual([])
  })

  it("cannot close its script element whatever the shop wrote", () => {
    const answer = "</script><script>alert(1)</script> & <b>"
    const [block] = faqJsonLd([faq("a", [{ question: "<Soru> & cevap", answer }])])

    const printed = scriptSafeJson(block)

    expect(printed).not.toMatch(/[<>&]/)
    expect(JSON.parse(printed)).toEqual(block)
  })
})
