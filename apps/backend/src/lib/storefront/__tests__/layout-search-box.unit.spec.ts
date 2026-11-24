import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { linksOf } from "../../../workflows/storefront/layout-check"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import type { BodySection } from "../layout"
import { CONTENT_PAGE_SECTION_TYPES } from "../layout-pages"
import { SEARCH_BOX_LIMITS, searchBox } from "../sections/search-box"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = (file: string) =>
  jest.requireActual<Record<string, unknown>>(
    path.resolve(__dirname, `../../../../../../packages/types/src/store/${file}.ts`)
  )

const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const PAGE = "cnt_01KABOUT0000000000000000"
const box = (more: Record<string, unknown> = {}) => ({ id: "arama01", type: "search_box", ...more })
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the search box section (adr/0077 §1)", () => {
  it("takes a box with no words, on the home page and a content page", () => {
    const doc = layoutDocument.parse({
      home: [box()],
      pages: [{ page_id: PAGE, sections: [box({ id: "arama02", title: "Turunu bul" })] }],
    })

    expect(doc.home[0]).toEqual({ ...box(), ...ALWAYS, title: null, intro: null })
    expect(doc.pages[0]?.sections[0]).toMatchObject({ type: "search_box", title: "Turunu bul" })
    expect(CONTENT_PAGE_SECTION_TYPES).toContain("search_box")
  })

  it("holds its intro to its length and refuses a stray field", () => {
    const long = "a".repeat(SEARCH_BOX_LIMITS.intro + 1)
    expect(issues({ home: [box({ intro: long })] })).not.toEqual([])
    expect(issues({ home: [box({ intro: "a".repeat(SEARCH_BOX_LIMITS.intro) })] })).toEqual([])
    // The fields are the theme's, never the section's
    expect(issues({ home: [box({ attribute_key: "gidilecek_yer" })] })).not.toEqual([])
  })

  it("is not offered on a product or a category page", () => {
    expect(issues({ product: [box()] })).toContain("storefront_layout.section_invalid")
    expect(issues({ category: [box({ placement: "top" })] })).toContain(
      "storefront_layout.section_invalid"
    )
  })

  it("mirrors the contract's limits and page list", () => {
    expect(SEARCH_BOX_LIMITS).toEqual(contract("section-search-box")["SEARCH_BOX_LIMITS"])
    expect(CONTENT_PAGE_SECTION_TYPES).toEqual(
      contract("section-pages")["CONTENT_PAGE_SECTION_TYPES"]
    )
  })
})

describe("the search box on the storefront", () => {
  const container = {} as MedusaContainer
  const values = {
    mağaza_adı: "Atölye",
    telefon: null,
    e_posta: null,
    adres: null,
    whatsapp: null,
    ücretsiz_kargo_eşiği: null,
  }
  const context = () =>
    ({ values, images: new Map(), links: new Map(), container }) as unknown as HydrateContext

  it("names no link", () => {
    expect(linksOf(searchBox.parse(box()) as BodySection)).toEqual([])
  })

  it("prints its words with the shop's details filled, the fields left to the theme", async () => {
    const section = searchBox.parse(
      box({ title: "Turunu bul", intro: "{mağaza_adı} ile yola çık", look: { ground: "well" } })
    )
    const shown = await hydrateSection(section, context())

    expect(shown).toEqual({
      id: "arama01",
      type: "search_box",
      title: "Turunu bul",
      intro: "Atölye ile yola çık",
      look: {
        space_outer: null,
        space_below: null,
        space_inner: null,
        ground: "well",
        align: null,
        width: null,
      },
    })
  })
})
