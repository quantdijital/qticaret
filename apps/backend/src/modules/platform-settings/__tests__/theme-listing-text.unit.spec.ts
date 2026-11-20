import path from "node:path"
import { layoutTheme, shownTheme, storedTheme } from "../../../lib/storefront/layout-theme"
import { mergePatch } from "../sections/define"
import { LISTING_TEXT, LISTING_TEXT_DEFAULTS, themeSection } from "../sections/theme"

const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/listing-text.ts"
)

const { full, patch, defaults } = themeSection

/** The theme without the group: a design's theme, a preset or a panel save before adr/0075. */
const before = (): Record<string, unknown> =>
  Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== "listing_text"))

/** adr/0075: how a category, brand or collection page's own text looks at its foot. */
describe("theme section: the listing text", () => {
  it("holds the contract's lists and defaults", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(LISTING_TEXT.size).toEqual(contract["LISTING_TEXT_SIZES"])
    expect(LISTING_TEXT.align).toEqual(contract["LISTING_TEXT_ALIGNS"])
    expect(LISTING_TEXT.width).toEqual(contract["LISTING_TEXT_WIDTHS"])
    expect(LISTING_TEXT_DEFAULTS).toEqual(contract["LISTING_TEXT_DEFAULTS"])
    expect(defaults.listing_text).toEqual({
      size: "md",
      align: "start",
      width: "narrow",
      collapse: true,
    })
  })

  it("takes every step on its lists, a patch of one field keeping the others", () => {
    for (const size of LISTING_TEXT.size) {
      for (const align of LISTING_TEXT.align) {
        for (const width of LISTING_TEXT.width) {
          const listing_text = { size, align, width, collapse: false }
          expect(full.safeParse({ ...defaults, listing_text }).success).toBe(true)
        }
      }
    }
    const body = patch.parse({ listing_text: { size: "lg" } })
    expect(full.parse(mergePatch(defaults, body)).listing_text).toEqual({
      ...LISTING_TEXT_DEFAULTS,
      size: "lg",
    })
  })

  it("refuses a step off its lists, a size in pixels and a font", () => {
    const off = (listing_text: Record<string, unknown>) =>
      full.safeParse({ ...defaults, listing_text: { ...LISTING_TEXT_DEFAULTS, ...listing_text } })
        .success
    expect(off({ size: "xl" })).toBe(false)
    expect(off({ size: 18 })).toBe(false)
    expect(off({ align: "end" })).toBe(false)
    expect(off({ width: "full" })).toBe(false)
    expect(off({ collapse: "yes" })).toBe(false)
    expect(off({ font: "inter" })).toBe(false)
  })

  it("reads a design's theme and takes a design save without it at its defaults", () => {
    const read = full.parse(storedTheme(before()))
    expect(read.listing_text).toEqual(LISTING_TEXT_DEFAULTS)
    expect(layoutTheme.parse(before())?.listing_text).toEqual(LISTING_TEXT_DEFAULTS)
    // A half-written group: the missing fields at their defaults
    expect(
      layoutTheme.parse({ ...before(), listing_text: { align: "center" } })?.listing_text
    ).toEqual({ ...LISTING_TEXT_DEFAULTS, align: "center" })
    expect(layoutTheme.parse(null)).toBeNull()
    expect(layoutTheme.safeParse({ ...defaults, listing_text: "wide" }).success).toBe(false)
  })

  it("is applied with the rest of the theme", () => {
    const written = {
      ...defaults,
      listing_text: { ...LISTING_TEXT_DEFAULTS, width: "wide" as const },
    }
    expect(shownTheme(written, defaults, null).listing_text).toEqual({
      ...LISTING_TEXT_DEFAULTS,
      width: "wide",
    })
    expect(shownTheme(null, defaults, null).listing_text).toEqual(LISTING_TEXT_DEFAULTS)
  })
})
