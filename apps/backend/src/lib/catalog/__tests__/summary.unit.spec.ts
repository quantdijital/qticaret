import type { Inline } from "../../content/doc"
import { productText, shortDescription } from "../../seo/product-text"
import {
  SUMMARY_TEXT_MAX,
  productSummaryDoc,
  storedSummaryText,
  summaryDocOf,
  summaryDocOfText,
  summaryText,
} from "../summary"
import type { SummaryDoc } from "../summary"

const text = (value: string, marks?: unknown[]) =>
  ({ type: "text", text: value, ...(marks ? { marks } : {}) }) as Inline

const DOC: SummaryDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        text("El yapımı, "),
        text("günlük", [{ type: "bold" }]),
        text(" kullanım için"),
        { type: "hardBreak" },
        text("bakım", [{ type: "link", attrs: { href: "/bakim" } }]),
        text(" kolay."),
      ],
    },
    { type: "heading", attrs: { level: 3 }, content: [text("Özellikler")] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [text("Kayın ağacı")] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [text("28 cm;")] }] },
      ],
    },
  ],
}

const refusal = (value: unknown) => {
  const parsed = productSummaryDoc.safeParse(value)
  return parsed.success ? null : parsed.error.issues[0]?.message
}

const paragraph = (value: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [text(value)] }],
})

describe("a product's short description (adr/0055 Ek 2026-11-06)", () => {
  it("takes paragraphs, line breaks, h3–h4 headings, lists, bold, italic and links", () => {
    expect(productSummaryDoc.parse(DOC)).toEqual(DOC)
    const https = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("Kılavuz", [{ type: "link", attrs: { href: "https://ornek.com/k" } }])],
        },
      ],
    }
    expect(refusal(https)).toBeNull()
  })

  it("refuses an h2, a quote, a table, a picture, an http link and text past the cap", () => {
    const picture = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "https://ornek.com/a.jpg" } }],
    }
    expect(refusal(picture)).toBe("catalog.summary_blocks")
    const h2 = {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 2 }, content: [text("Başlık")] }],
    }
    expect(refusal(h2)).toBe("catalog.summary_blocks")
    const quote = {
      type: "doc",
      content: [{ type: "blockquote", content: [paragraph("Alıntı").content[0]] }],
    }
    expect(refusal(quote)).toBe("catalog.summary_blocks")
    const table = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [{ type: "tableCell", content: [paragraph("a").content[0]] }],
            },
          ],
        },
      ],
    }
    expect(refusal(table)).toBe("catalog.summary_blocks")
    const http = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("eski", [{ type: "link", attrs: { href: "http://ornek.com" } }])],
        },
      ],
    }
    expect(refusal(http)).toBe("catalog.summary_link")
    expect(refusal(paragraph("x".repeat(SUMMARY_TEXT_MAX)))).toBeNull()
    expect(refusal(paragraph("x".repeat(SUMMARY_TEXT_MAX + 1)))).toBe("catalog.summary_too_long")
    // The content checks still hold: a control character, the old lines' shape
    expect(refusal(paragraph("zil\u0007"))).toBe("content.body_invalid")
    expect(refusal(["satır"])).toBe("content.body_invalid")
  })

  it("reads a stored value again: none for one without text or that no longer passes", () => {
    expect(summaryDocOf(DOC)).toEqual(DOC)
    expect(summaryDocOf(null)).toBeNull()
    expect(summaryDocOf({ type: "doc", content: [{ type: "paragraph" }] })).toBeNull()
    expect(summaryDocOf(["eski", "satırlar"])).toBeNull()
  })

  it("is one line of plain text for SEO: blocks and items as sentences, cut at a word", () => {
    expect(summaryText(DOC)).toBe(
      "El yapımı, günlük kullanım için. bakım kolay. Özellikler. Kayın ağacı. 28 cm;"
    )
    expect(summaryText(null)).toBe("")
    const long = summaryText(DOC, 40)
    expect(long.length).toBeLessThanOrEqual(40)
    expect(long).toBe("El yapımı, günlük kullanım için. bakım")
    expect(storedSummaryText(DOC)).toBe(summaryText(DOC))
    expect(storedSummaryText(undefined)).toBe("")
  })

  it("stands in for the token and for JSON-LD and the feeds", () => {
    const summary = summaryText(DOC)
    // The template puts its own full stop
    expect(shortDescription("Yıkanmış keten. Rahat kesim.", "Alt başlık", "Uzun")).toBe(
      "Yıkanmış keten. Rahat kesim"
    )
    expect(shortDescription("", "Alt başlık", "Uzun metin.")).toBe("Alt başlık")
    expect(shortDescription("", "", "Uzun metin.")).toBe("Uzun metin.")
    expect(shortDescription(summary, "", "").length).toBeLessThanOrEqual(140)
    expect(productText("<p>Kendi açıklaması</p>", summary)).toBe("Kendi açıklaması")
    expect(productText("", summary)).toBe(summary)
  })

  it("makes a sheet's plain text one paragraph, its lines as line breaks", () => {
    const doc = summaryDocOfText("  Yıkanmış   keten\r\n\n Rahat kesim ")
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [text("Yıkanmış keten"), { type: "hardBreak" }, text("Rahat kesim")],
        },
      ],
    })
    // A short description the panel takes, read back as the export writes it
    expect(productSummaryDoc.parse(doc)).toEqual(doc)
    expect(summaryText(doc)).toBe("Yıkanmış keten. Rahat kesim.")
    expect(summaryDocOfText(" \n ")).toBeNull()
  })
})
