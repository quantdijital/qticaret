import path from "node:path"
import { layoutDocument, readStoredLayout } from "../layout"
import { mainSectionsOf, withMainSections } from "../layout-main"
import { HEADER_MENU_IMAGES } from "../sections/main"

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

describe("the menus' pictures (adr/0049 Ek 2026-11-15; adr/0066 K3b, K6)", () => {
  it("reads a header bar saved without them as drawn before: pictures in the submenus only", () => {
    for (const variant of VARIANTS) {
      const old = readStoredLayout(header({ variant, sticky: false }))
      expect(old.header.at(-1)).toMatchObject({ variant, menu_images: "submenus" })
      expect(mainSectionsOf(old).header_bar).toMatchObject({ variant, menu_images: "submenus" })
    }
    // A design with no header bar at all takes the theme's, with the same default
    const plain = withMainSections(layoutDocument.parse({}), { layout: "left", sticky: true })
    expect(mainSectionsOf(plain).header_bar.menu_images).toBe("submenus")
  })

  it("keeps each step through a save and the storefront's answer, on every variant", () => {
    for (const variant of VARIANTS) {
      for (const step of HEADER_MENU_IMAGES) {
        const doc = layoutDocument.parse(header({ variant, menu_images: step }))
        expect(doc.header.at(-1)).toMatchObject({ variant, menu_images: step })
        expect(mainSectionsOf(doc).header_bar).toMatchObject({ variant, menu_images: step })
      }
    }
  })

  it("refuses a save with a step off the list, a switch's true/false among them", () => {
    for (const stray of [true, false, "on", "none", null, 1]) {
      expect(issues(header({ menu_images: stray }))).toContain("storefront_layout.section_invalid")
    }
  })

  it("reads a stored design's step off the list as the default, the bar's other settings kept", () => {
    for (const stray of [true, false, "on"]) {
      const doc = readStoredLayout(
        header({ variant: "catalog", sticky: false, menu_ground: "well", menu_images: stray })
      )
      expect(doc.header.at(-1)).toMatchObject({
        variant: "catalog",
        sticky: false,
        menu_ground: "well",
        menu_images: "submenus",
      })
    }
  })

  it("mirrors the contract's steps", () => {
    const contract = jest.requireActual<{ HEADER_MENU_IMAGES: unknown }>(CONTRACT_FILE)
    expect(HEADER_MENU_IMAGES).toEqual(contract.HEADER_MENU_IMAGES)
  })
})
