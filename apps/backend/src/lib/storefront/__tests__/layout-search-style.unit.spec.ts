import path from "node:path"
import { layoutDocument, readStoredLayout } from "../layout"
import { mainSectionsOf, withMainSections } from "../layout-main"
import { HEADER_SEARCH_STYLES } from "../sections/main"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-variants.ts"
)

const VARIANTS = ["standard", "centered", "catalog"] as const
const header = (fields: Record<string, unknown>) => ({
  header: [{ id: "mainheader", type: "header_bar", ...fields }],
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the header search's look (adr/0049 Ek 2026-11-15; adr/0066 K3b)", () => {
  it("reads a header bar saved without it as drawn before: the box", () => {
    for (const variant of VARIANTS) {
      const old = readStoredLayout(header({ variant, sticky: false }))
      expect(old.header.at(-1)).toMatchObject({ variant, search_style: "field" })
      expect(mainSectionsOf(old).header_bar).toMatchObject({ variant, search_style: "field" })
    }
    // A design with no header bar at all takes the theme's, with the same default
    const plain = withMainSections(layoutDocument.parse({}), { layout: "centered", sticky: true })
    expect(mainSectionsOf(plain).header_bar.search_style).toBe("field")
  })

  it("keeps each step through a save and the storefront's answer, on every variant", () => {
    for (const variant of VARIANTS) {
      for (const step of HEADER_SEARCH_STYLES) {
        const doc = layoutDocument.parse(header({ variant, search_style: step }))
        expect(doc.header.at(-1)).toMatchObject({ variant, search_style: step })
        expect(mainSectionsOf(doc).header_bar).toMatchObject({ variant, search_style: step })
      }
    }
  })

  it("refuses a save with a step off the list", () => {
    for (const stray of [true, false, "button", "", null, 1]) {
      expect(issues(header({ search_style: stray }))).toContain("storefront_layout.section_invalid")
    }
  })

  it("reads a stored design's step off the list as the box, the bar's other settings kept", () => {
    const doc = readStoredLayout(
      header({ variant: "centered", sticky: false, menu_images: "off", search_style: "drawer" })
    )
    expect(doc.header.at(-1)).toMatchObject({
      variant: "centered",
      sticky: false,
      menu_images: "off",
      search_style: "field",
    })
  })

  it("mirrors the contract's steps", () => {
    const contract = jest.requireActual<{ HEADER_SEARCH_STYLES: unknown }>(CONTRACT_FILE)
    expect(HEADER_SEARCH_STYLES).toEqual(contract.HEADER_SEARCH_STYLES)
  })
})
