import path from "node:path"
import { headerLinked, linksOf } from "../../../workflows/storefront/layout-check"
import { layoutDocument, readStoredLayout } from "../layout"
import { mainSectionsOf, withMainSections } from "../layout-main"
import { HEADER_CATALOG_LIMITS, HEADER_MENU_GROUNDS } from "../sections/main"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-variants.ts"
)

const LEFT = { layout: "left", sticky: true } as const
const catalog = (more: Record<string, unknown> = {}) => ({
  id: "mainheader",
  type: "header_bar",
  variant: "catalog",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

const DEFAULTS = {
  search_placeholder: null,
  search_label: false,
  account_text: true,
  cart_total: false,
  highlight_link: null,
  utility_bar: true,
  phone: true,
  categories_button: true,
  menu_ground: "stage",
}

describe("the catalog header (adr/0049 Ek 2026-11-14 N14, Ek 2026-11-15)", () => {
  it("reads a bar switched to it with every setting's default", () => {
    const doc = layoutDocument.parse({ header: [catalog()] })
    expect(doc.header[0]).toMatchObject({ variant: "catalog", sticky: true, ...DEFAULTS })
  })

  it("keeps what the shop set and refuses a step off its list or too long words", () => {
    const set = {
      search_placeholder: "Ürün, marka ya da kod",
      search_label: true,
      account_text: false,
      cart_total: true,
      highlight_link: { kind: "system", target: "sale", label: "Kampanyalar" },
      utility_bar: false,
      phone: false,
      categories_button: false,
      menu_ground: "primary",
    }
    expect(layoutDocument.parse({ header: [catalog(set)] }).header[0]).toMatchObject(set)
    expect(issues({ header: [catalog({ menu_ground: "red" })] })).toContain(
      "storefront_layout.section_invalid"
    )
    expect(
      issues({ header: [catalog({ search_placeholder: "a".repeat(61) })] }).length
    ).toBeGreaterThan(0)
    // A setting of the catalog bar on today's is a forged editor
    expect(issues({ header: [catalog({ variant: "standard", phone: true })] }).length).toBe(1)
  })

  it("drops its settings when a stored bar names a variant off the list, and keeps them on its own", () => {
    const stored = readStoredLayout({
      header: [{ ...catalog({ phone: false }), variant: "shrinking" }],
    })
    expect(stored.header[0]).toEqual(expect.objectContaining({ variant: "standard" }))
    expect(stored.header[0]).not.toHaveProperty("phone")
    const kept = readStoredLayout({ header: [catalog({ phone: false })] })
    expect(kept.header[0]).toMatchObject({ variant: "catalog", phone: false })
  })

  it("names its highlighted link for the save's checks and the reading", () => {
    const sale = { kind: "category", target: "pcat_01", label: "İndirim" } as const
    const doc = layoutDocument.parse({ header: [catalog({ highlight_link: sale })] })
    expect(headerLinked(doc).flatMap(linksOf)).toEqual([sale])
    expect(headerLinked(layoutDocument.parse({ header: [catalog()] })).flatMap(linksOf)).toEqual([])
  })

  it("gives the storefront its settings, the link placed (a broken one none)", () => {
    const sale = { kind: "system", target: "sale", label: null } as const
    const doc = withMainSections(
      layoutDocument.parse({ header: [catalog({ highlight_link: sale, cart_total: true })] }),
      LEFT
    )
    const placed = { label: "Kampanyalar", kind: "system", target: "sale", path: null }
    expect(mainSectionsOf(doc, () => placed).header_bar).toEqual({
      id: "mainheader",
      type: "header_bar",
      variant: "catalog",
      sticky: true,
      catalog: { ...DEFAULTS, cart_total: true, highlight_link: placed },
    })
    expect(mainSectionsOf(doc).header_bar.catalog?.highlight_link).toBeNull()
    // Today's bar carries none
    const plain = withMainSections(layoutDocument.parse({}), LEFT)
    expect(mainSectionsOf(plain).header_bar).not.toHaveProperty("catalog")
  })

  it("mirrors the contract's ground list and limits", () => {
    const contract = jest.requireActual<{
      HEADER_MENU_GROUNDS: unknown
      HEADER_CATALOG_LIMITS: unknown
    }>(CONTRACT_FILE)
    expect(HEADER_MENU_GROUNDS).toEqual(contract.HEADER_MENU_GROUNDS)
    expect(HEADER_CATALOG_LIMITS).toEqual(contract.HEADER_CATALOG_LIMITS)
  })
})
