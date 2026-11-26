import path from "node:path"
import { layoutDocument, readStoredLayout } from "../layout"
import { mainSectionsOf } from "../layout-main"
import { HEADER_SUBMENU_STYLES } from "../sections/main"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-variants.ts"
)

const VARIANTS = ["standard", "centered", "inline", "catalog"] as const
const header = (fields: Record<string, unknown>) => ({
  header: [{ id: "mainheader", type: "header_bar", ...fields }],
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("how the header's submenus open (adr/0049 Ek 2026-11-26)", () => {
  it("prints nothing for a bar saved without it: the dropdown list, as drawn before", () => {
    for (const variant of VARIANTS) {
      const old = readStoredLayout(header({ variant, sticky: false }))
      expect(mainSectionsOf(old).header_bar).not.toHaveProperty("submenu_style")
    }
  })

  it("keeps each step through a save and the storefront's answer, on every variant", () => {
    for (const variant of VARIANTS) {
      for (const step of HEADER_SUBMENU_STYLES) {
        const doc = layoutDocument.parse(header({ variant, submenu_style: step }))
        expect(doc.header[0]).toMatchObject({ variant, submenu_style: step })
        expect(mainSectionsOf(doc).header_bar).toMatchObject({ variant, submenu_style: step })
      }
    }
  })

  it("refuses a save with a step off the list", () => {
    for (const stray of [true, "panel", "", null, 1]) {
      expect(issues(header({ submenu_style: stray }))).toContain(
        "storefront_layout.section_invalid"
      )
    }
  })

  it("drops a stored step off the list, the bar's other settings kept", () => {
    const doc = readStoredLayout(
      header({ variant: "centered", sticky: false, menu_images: "off", submenu_style: "grid" })
    )
    expect(doc.header[0]).toMatchObject({ variant: "centered", sticky: false, menu_images: "off" })
    expect(doc.header[0]).not.toHaveProperty("submenu_style")
  })

  it("mirrors the contract's steps", () => {
    const contract = jest.requireActual<{ HEADER_SUBMENU_STYLES: unknown }>(CONTRACT_FILE)
    expect(HEADER_SUBMENU_STYLES).toEqual(contract.HEADER_SUBMENU_STYLES)
  })
})
