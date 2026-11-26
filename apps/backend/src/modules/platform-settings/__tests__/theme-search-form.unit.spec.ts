import path from "node:path"
import { layoutTheme, shownTheme, storedTheme } from "../../../lib/storefront/layout-theme"
import { mergePatch } from "../sections/define"
import { themeSection } from "../sections/theme"
import { SEARCH_FORM_CATEGORY_STYLES, SEARCH_FORM_DEFAULTS } from "../sections/theme-search-form"

const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/search-form.ts"
)

const { full, patch, defaults } = themeSection

/** The theme without the group: a design's theme, a preset or a panel save before adr/0077. */
const before = (): Record<string, unknown> =>
  Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== "search_form"))

/** adr/0077 §1: the search box's fields, one theme setting. */
describe("theme section: the search form", () => {
  it("holds the contract's list and defaults", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(SEARCH_FORM_CATEGORY_STYLES).toEqual(contract["SEARCH_FORM_CATEGORY_STYLES"])
    expect(SEARCH_FORM_DEFAULTS).toEqual(contract["SEARCH_FORM_DEFAULTS"])
    expect(defaults.search_form).toEqual({
      attribute_key: null,
      show_category: true,
      show_dates: true,
      show_people: true,
      flexible_month: true,
      date_words: false,
      boxed_fields: false,
      category_style: "select",
      placeholder: null,
    })
  })

  it("takes every field, and a patch of one", () => {
    for (const category_style of SEARCH_FORM_CATEGORY_STYLES) {
      const search_form = {
        attribute_key: "gidilecek_yer",
        show_category: false,
        show_dates: false,
        show_people: false,
        flexible_month: false,
        date_words: true,
        boxed_fields: true,
        category_style,
        placeholder: "Nereye gitmek istersiniz?",
      }
      expect(full.safeParse({ ...defaults, search_form }).success).toBe(true)
    }
    const body = patch.parse({ search_form: { category_style: "tabs" } })
    expect(full.parse(mergePatch(defaults, body)).search_form).toEqual({
      ...SEARCH_FORM_DEFAULTS,
      category_style: "tabs",
    })
  })

  it("refuses a style off its list, a malformed or reserved key and an unknown field", () => {
    const off = (search_form: Record<string, unknown>) =>
      full.safeParse({ ...defaults, search_form: { ...SEARCH_FORM_DEFAULTS, ...search_form } })
        .success
    expect(off({ category_style: "pills" })).toBe(false)
    expect(off({ placeholder: "" })).toBe(false)
    expect(off({ placeholder: "x".repeat(61) })).toBe(false)
    expect(off({ attribute_key: "Gidilecek Yer" })).toBe(false)
    expect(off({ attribute_key: "" })).toBe(false)
    // A name the listing's address keeps for itself is never a filter there
    expect(off({ attribute_key: "kategori" })).toBe(false)
    expect(off({ attribute_key: "tarih" })).toBe(false)
    expect(off({ attribute_key: "marka" })).toBe(false)
    expect(off({ show_dates: "yes" })).toBe(false)
    expect(off({ date_words: "yes" })).toBe(false)
    expect(off({ boxed_fields: "yes" })).toBe(false)
    expect(off({ show_words: true })).toBe(false)
  })

  it("reads a design's theme and takes a design save without it at its defaults", () => {
    expect(full.parse(storedTheme(before())).search_form).toEqual(SEARCH_FORM_DEFAULTS)
    expect(layoutTheme.parse(before())?.search_form).toEqual(SEARCH_FORM_DEFAULTS)
    // A half-written group: the missing fields at their defaults
    expect(
      layoutTheme.parse({ ...before(), search_form: { show_people: false } })?.search_form
    ).toEqual({ ...SEARCH_FORM_DEFAULTS, show_people: false })
    expect(layoutTheme.safeParse({ ...defaults, search_form: "tabs" }).success).toBe(false)
  })

  it("is applied with the rest of the theme", () => {
    const written = {
      ...defaults,
      search_form: { ...SEARCH_FORM_DEFAULTS, attribute_key: "gidilecek_yer" },
    }
    expect(shownTheme(written, defaults, null).search_form).toEqual({
      ...SEARCH_FORM_DEFAULTS,
      attribute_key: "gidilecek_yer",
    })
    expect(shownTheme(null, defaults, null).search_form).toEqual(SEARCH_FORM_DEFAULTS)
  })
})
