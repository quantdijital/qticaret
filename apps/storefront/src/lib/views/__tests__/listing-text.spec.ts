import { describe, expect, it } from "vitest"
import { LISTING_TEXT_DEFAULTS } from "@qticaret/types/listing-text"
import { listingTextView } from "../listing-text"

/** A listing's text at its foot (adr/0075 §5, §6): the document's HTML, else the plain paragraphs. */

const HTML = "<h2>Çelik</h2><p>Elde dövülür.</p>"

describe("listingTextView (adr/0075)", () => {
  it("gives the document's HTML as the backend wrote it, no paragraphs beside it", () => {
    expect(listingTextView({ html: HTML, plain: "Elde dövülür." }, undefined, 1)).toEqual({
      html: HTML,
      paragraphs: [],
      look: LISTING_TEXT_DEFAULTS,
    })
  })

  it("falls back to the plain text's paragraphs without a document, an empty one or an older backend's", () => {
    const plain = "Birinci paragraf.\n\nİkinci  paragraf."
    for (const html of [null, undefined, "  "]) {
      expect(listingTextView({ html, plain }, null, 1)).toEqual({
        html: null,
        paragraphs: ["Birinci paragraf.", "İkinci paragraf."],
        look: LISTING_TEXT_DEFAULTS,
      })
    }
  })

  it("gives none past the first page, for a record without words, or with no source", () => {
    expect(listingTextView({ html: HTML, plain: "x" }, null, 2)).toBeNull()
    expect(listingTextView({ html: null, plain: "  " }, null, 1)).toBeNull()
    expect(listingTextView({ html: null, plain: null }, null, 1)).toBeNull()
    expect(listingTextView(undefined, null, 1)).toBeNull()
  })

  it("keeps the shop's look, each missing or unknown value at its default", () => {
    const look = { size: "lg", align: "center", width: "wide", collapse: false } as const
    expect(listingTextView({ html: HTML, plain: null }, look, 1)?.look).toEqual(look)
    expect(
      listingTextView({ html: HTML, plain: null }, { size: "xl" as never, align: "center" }, 1)
        ?.look
    ).toEqual({ ...LISTING_TEXT_DEFAULTS, align: "center" })
  })
})
