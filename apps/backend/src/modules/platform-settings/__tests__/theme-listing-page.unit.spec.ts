import path from "node:path"
import { layoutTheme, shownTheme, storedTheme } from "../../../lib/storefront/layout-theme"
import { mergePatch } from "../sections/define"
import { LISTING_PAGE, LISTING_PAGE_DEFAULTS, themeSection } from "../sections/theme"
import { LISTING_ALL_TITLE_MAX, LISTING_COUNT_WORD_MAX } from "../sections/theme-listing-page"

const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/listing-page.ts"
)

const { full, patch, defaults } = themeSection

/** The theme without the group: a design's theme, a preset or a panel save before it. */
const before = (): Record<string, unknown> =>
  Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== "listing_page"))

/** A listing page's grid or list, its switch and its trail; today's page by default. */
describe("theme section: the listing page", () => {
  it("holds the contract's lists and defaults", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(LISTING_PAGE.default_view).toEqual(contract["LISTING_VIEWS"])
    expect(LISTING_PAGE.view_switch).toEqual(contract["LISTING_VIEW_SWITCHES"])
    expect(LISTING_PAGE.breadcrumb_current).toEqual(contract["LISTING_BREADCRUMB_CURRENTS"])
    expect(LISTING_PAGE.crumbs_place).toEqual(contract["LISTING_CRUMBS_PLACES"])
    expect(LISTING_PAGE_DEFAULTS).toEqual(contract["LISTING_PAGE_DEFAULTS"])
    expect(LISTING_COUNT_WORD_MAX).toBe(contract["LISTING_COUNT_WORD_MAX"])
    expect(LISTING_ALL_TITLE_MAX).toBe(contract["LISTING_ALL_TITLE_MAX"])
    expect(defaults.listing_page).toEqual({
      default_view: "grid",
      view_switch: "hide",
      breadcrumb_current: "show",
      crumbs_place: "above",
      count_word: null,
      all_title: null,
    })
  })

  it("takes every step on its lists, a patch of one field keeping the others", () => {
    for (const default_view of LISTING_PAGE.default_view) {
      for (const view_switch of LISTING_PAGE.view_switch) {
        for (const breadcrumb_current of LISTING_PAGE.breadcrumb_current) {
          for (const crumbs_place of LISTING_PAGE.crumbs_place) {
            const listing_page = {
              default_view,
              view_switch,
              breadcrumb_current,
              crumbs_place,
              count_word: null,
              all_title: null,
            }
            expect(full.safeParse({ ...defaults, listing_page }).success).toBe(true)
          }
        }
      }
    }
    const body = patch.parse({ listing_page: { view_switch: "show" } })
    expect(full.parse(mergePatch(defaults, body)).listing_page).toEqual({
      ...LISTING_PAGE_DEFAULTS,
      view_switch: "show",
    })
  })

  it("refuses a step off its lists and a field it does not have", () => {
    const off = (listing_page: Record<string, unknown>) =>
      full.safeParse({ ...defaults, listing_page: { ...LISTING_PAGE_DEFAULTS, ...listing_page } })
        .success
    expect(off({ default_view: "table" })).toBe(false)
    expect(off({ view_switch: true })).toBe(false)
    expect(off({ breadcrumb_current: "none" })).toBe(false)
    expect(off({ crumbs_place: "left" })).toBe(false)
    // Turned off is on the list (no visible trail, the BreadcrumbList data kept)
    expect(off({ crumbs_place: "none" })).toBe(true)
    expect(off({ columns: 4 })).toBe(false)
  })

  it("takes the count's word trimmed, refusing an empty or a long one", () => {
    const word = (count_word: unknown) =>
      full.safeParse({ ...defaults, listing_page: { ...LISTING_PAGE_DEFAULTS, count_word } })
    const read = word("  tur ")
    expect(read.success && read.data.listing_page.count_word).toBe("tur")
    expect(word(null).success).toBe(true)
    expect(word("x".repeat(LISTING_COUNT_WORD_MAX)).success).toBe(true)
    expect(word("x".repeat(LISTING_COUNT_WORD_MAX + 1)).success).toBe(false)
    expect(word("   ").success).toBe(false)
    expect(word(3).success).toBe(false)
  })

  it("takes the all-products title trimmed, refusing an empty or a long one", () => {
    const title = (all_title: unknown) =>
      full.safeParse({ ...defaults, listing_page: { ...LISTING_PAGE_DEFAULTS, all_title } })
    const read = title(" Tüm turlar ")
    expect(read.success && read.data.listing_page.all_title).toBe("Tüm turlar")
    expect(title(null).success).toBe(true)
    expect(title("x".repeat(LISTING_ALL_TITLE_MAX)).success).toBe(true)
    expect(title("x".repeat(LISTING_ALL_TITLE_MAX + 1)).success).toBe(false)
    expect(title(" ").success).toBe(false)
  })

  it("reads a design's theme and takes a design save without it at its defaults", () => {
    const read = full.parse(storedTheme(before()))
    expect(read.listing_page).toEqual(LISTING_PAGE_DEFAULTS)
    expect(layoutTheme.parse(before())?.listing_page).toEqual(LISTING_PAGE_DEFAULTS)
    expect(
      layoutTheme.parse({ ...before(), listing_page: { view_switch: "show" } })?.listing_page
    ).toEqual({ ...LISTING_PAGE_DEFAULTS, view_switch: "show" })
    expect(layoutTheme.safeParse({ ...defaults, listing_page: "list" }).success).toBe(false)
  })

  it("is applied with the rest of the theme", () => {
    const written = {
      ...defaults,
      listing_page: { ...LISTING_PAGE_DEFAULTS, breadcrumb_current: "hide" as const },
    }
    expect(shownTheme(written, defaults, null).listing_page).toEqual({
      ...LISTING_PAGE_DEFAULTS,
      breadcrumb_current: "hide",
      crumbs_place: "above",
    })
    expect(shownTheme(null, defaults, null).listing_page).toEqual(LISTING_PAGE_DEFAULTS)
  })
})
