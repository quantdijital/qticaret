import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { ATOLYE_SOURCE, atolyeCss } from "@/test/atolye-css"
import { px, tokenAt, utilityAt } from "@/test/atolye-token-at"

/**
 * The gaps under a section's heading and between a grid's rows were
 * written by hand in each section (`gap-6 lg:gap-10`); they moved onto
 * tokens (`--head-gap*`, `--gap-rows*`, `tokens.css`) so the shop's density
 * can read them (adr/0067 Ek 2026-11-16, its first commit: a move only).
 * The proof the move changed no pixel: each place's old classes and its
 * token resolve to the same length at every width the classes or the
 * tokens step at, on either side of each step.
 */

const TOKENS = [atolyeCss("tokens.css")]

/** Every width a step falls on (640, 768, 1024), each side of it, a phone's and a wide screen's. */
const WIDTHS = [360, 390, 639, 640, 641, 767, 768, 1023, 1024, 1025, 1280, 1440, 1920]

interface Moved {
  file: string
  /** The classes as they were, for the one property moved. */
  before: string
  /** The class it is now. */
  now: string
  token: string
  /** Tailwind's property prefix the old classes set. */
  property: "gap" | "gap-y"
}

const HEAD = (file: string): Moved => ({
  file,
  before: "gap-6 lg:gap-10",
  now: "gap-(--head-gap)",
  token: "--head-gap",
  property: "gap",
})
const HEAD_S = (file: string): Moved => ({
  file,
  before: "gap-6",
  now: "gap-(--head-gap-s)",
  token: "--head-gap-s",
  property: "gap",
})
const ROWS_S = (file: string): Moved => ({
  file,
  before: "gap-y-8",
  now: "gap-y-(--gap-rows-s)",
  token: "--gap-rows-s",
  property: "gap-y",
})

const MOVED: readonly Moved[] = [
  HEAD("sections/Aisles.tsx"),
  HEAD("sections/CategoryCards.tsx"),
  HEAD("sections/CategoryCollage.tsx"),
  HEAD("sections/Guides.tsx"),
  HEAD("sections/GoogleRating.tsx"),
  HEAD("sections/Reviews.tsx"),
  HEAD("ProductPage.tsx"),
  {
    file: "sections/PriceBands.tsx",
    before: "gap-6 lg:gap-8",
    now: "gap-(--head-gap-m)",
    token: "--head-gap-m",
    property: "gap",
  },
  HEAD_S("sections/ShelfRack.tsx"),
  HEAD_S("sections/ShelfTabs.tsx"),
  HEAD_S("sections/Brands.tsx"),
  HEAD_S("sections/CustomerPhotos.tsx"),
  HEAD_S("parts/Scroller.tsx"),
  {
    file: "parts/ProductCard.tsx",
    before: "gap-y-8 lg:gap-y-10",
    now: "gap-y-(--gap-rows)",
    token: "--gap-rows",
    property: "gap-y",
  },
  {
    file: "account/Favorites.tsx",
    before: "gap-y-8 lg:gap-y-10",
    now: "gap-y-(--gap-rows)",
    token: "--gap-rows",
    property: "gap-y",
  },
  ROWS_S("sections/ShelfLayouts.tsx"),
  ROWS_S("sections/CategoryCards.tsx"),
]

describe("the section gaps' move onto tokens (adr/0067 Ek 2026-11-16, a move only)", () => {
  it.each(MOVED)("$file: $before is $now at every width", ({ before, token, property }) => {
    const table = WIDTHS.map((width) => ({
      width,
      before: utilityAt(before, property, width),
      token: px(tokenAt(TOKENS, token, width)),
    }))
    expect(table.filter((row) => row.before !== row.token)).toEqual([])
  })

  it.each(MOVED)("$file writes $now", ({ file, now }) => {
    expect(readFileSync(`${ATOLYE_SOURCE}${file}`, "utf8")).toContain(now)
  })

  it("resolves the classes and tokens the way a browser would", () => {
    // The resolver itself: Tailwind's `lg:` takes 1024 px, the tokens' `max-width: 64rem` too
    expect(utilityAt("gap-6 lg:gap-10", "gap", 1023)).toBe(24)
    expect(utilityAt("gap-6 lg:gap-10", "gap", 1024)).toBe(40)
    expect(px(tokenAt(TOKENS, "--head-gap", 1023))).toBe(24)
    expect(px(tokenAt(TOKENS, "--head-gap", 1024))).toBe(40)
    expect(px(tokenAt(TOKENS, "--gap-columns", 640))).toBe(12)
    expect(px(tokenAt(TOKENS, "--gap-columns", 641))).toBe(24)
    expect(px(tokenAt(TOKENS, "--gutter", 1024))).toBe(24)
    expect(px(tokenAt(TOKENS, "--gutter", 1025))).toBe(48)
  })
})
