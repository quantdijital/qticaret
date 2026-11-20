import { describe, expect, it } from "vitest"
import {
  LISTING_TEXT_ALIGNS,
  LISTING_TEXT_DEFAULTS,
  LISTING_TEXT_SIZES,
  LISTING_TEXT_WIDTHS,
  listingTextOf,
} from "./listing-text.js"

/** adr/0075: a listing page's own text at its foot, one theme setting. */
describe("listing text settings", () => {
  it("defaults to a normal size from the start, a reading measure, folded", () => {
    expect(LISTING_TEXT_DEFAULTS).toEqual({
      size: "md",
      align: "start",
      width: "narrow",
      collapse: true,
    })
    expect(LISTING_TEXT_SIZES).toContain(LISTING_TEXT_DEFAULTS.size)
    expect(LISTING_TEXT_ALIGNS).toContain(LISTING_TEXT_DEFAULTS.align)
    expect(LISTING_TEXT_WIDTHS).toContain(LISTING_TEXT_DEFAULTS.width)
  })

  it("reads none (a backend before it) and unknown values at their defaults", () => {
    expect(listingTextOf(undefined)).toEqual(LISTING_TEXT_DEFAULTS)
    expect(listingTextOf(null)).toEqual(LISTING_TEXT_DEFAULTS)
    expect(listingTextOf({ size: "xl", align: "end", width: 900, collapse: "no" })).toEqual(
      LISTING_TEXT_DEFAULTS
    )
    expect(listingTextOf({ size: "lg", align: "center", width: "wide", collapse: false })).toEqual({
      size: "lg",
      align: "center",
      width: "wide",
      collapse: false,
    })
  })
})
