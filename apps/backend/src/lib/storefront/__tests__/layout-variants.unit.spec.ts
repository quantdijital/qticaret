import path from "node:path"
import { layoutDocument, readStoredLayout, storedDocument } from "../layout"
import { storedSection } from "../sections/stored"
import { SECTION_VARIANTS } from "../sections/variants"
import { PRODUCT_CARD_VARIANTS } from "../../../modules/platform-settings/sections/theme"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-variants.ts"
)

// Every body section shows on every screen unless the shop picks one (bilesen-standardi §2)
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const badges = (more: Record<string, unknown> = {}) => ({
  id: "guvenserit",
  type: "trust_badges",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("section variants (adr/0049 Ek 2026-11-14 §2)", () => {
  it("reads a section saved before variants as its type's default, on every page", () => {
    const doc = layoutDocument.parse({
      home: [badges()],
      product: [badges({ id: "urunguven" })],
      category: [badges({ id: "kategoriguven" })],
    })

    expect(doc.home).toEqual([{ ...badges(), ...ALWAYS, variant: "strip" }])
    expect(doc.product[0]).toMatchObject({ variant: "strip" })
    expect(doc.category[0]).toMatchObject({ variant: "strip", placement: "bottom" })
  })

  it("keeps a variant on the type's list, a category page's place with it", () => {
    const doc = layoutDocument.parse({
      home: [badges({ variant: "lined" })],
      category: [badges({ id: "kategoriguven", variant: "lined", placement: "top" })],
    })

    expect(doc.home[0]).toMatchObject({ type: "trust_badges", variant: "lined" })
    expect(doc.category[0]).toMatchObject({ variant: "lined", placement: "top" })
  })

  it("refuses a save naming a variant off the list, or a field no variant has", () => {
    expect(issues({ home: [badges({ variant: "boxed" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ product: [badges({ variant: null })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [badges({ variant: "lined", heading: "x" })] })).toHaveLength(1)
  })

  it("reads a stored variant off the list as the default, keeping only the default's fields", () => {
    const stored = {
      home: [badges({ ...ALWAYS, variant: "removed_one", only_there: true })],
      category: [badges({ id: "kategoriguven", ...ALWAYS, variant: 7, placement: "top" })],
    }

    const doc = readStoredLayout(stored)

    expect(doc.home).toEqual([{ ...badges(), ...ALWAYS, variant: "strip" }])
    expect(doc.category[0]).toMatchObject({ variant: "strip", placement: "top" })
    // A save of the same document is still held to the list
    expect(layoutDocument.safeParse(stored).success).toBe(false)
  })

  it("leaves a listed or missing variant and a type without variants as they are", () => {
    const listed = badges({ variant: "lined" })
    const plain = { id: "yardim0001", type: "help", variant: "nope" }

    expect(storedSection(listed)).toBe(listed)
    expect(storedSection(badges())).toEqual(badges())
    expect(storedSection(plain)).toBe(plain)
    expect(storedDocument({ home: "not a list" })).toMatchObject({ home: "not a list" })
  })

  it("names the drawing from before variants first: the default", () => {
    expect(SECTION_VARIANTS.trust_badges[0]).toBe("strip")
  })

  it("mirrors the contract's lists: a variant goes there first", () => {
    const contract = jest.requireActual<{ SECTION_VARIANTS: unknown; CARD_VARIANTS: unknown }>(
      CONTRACT_FILE
    )
    expect(SECTION_VARIANTS).toEqual(contract.SECTION_VARIANTS)
    expect(PRODUCT_CARD_VARIANTS).toEqual(contract.CARD_VARIANTS)
  })
})

describe("a product rail's card variant (adr/0049 Ek 2026-11-14 §3.3, owner's decision 4)", () => {
  const rail = (more: Record<string, unknown> = {}) => ({
    id: "yeniurunler",
    type: "products",
    title: null,
    source: { kind: "newest" },
    ...more,
  })

  it("is the theme setting's (null) for a rail saved before it, and keeps one on the list", () => {
    expect(layoutDocument.parse({ home: [rail()] }).home[0]).toMatchObject({ card_variant: null })
    expect(
      layoutDocument.parse({ home: [rail({ card_variant: "framed" })] }).home[0]
    ).toMatchObject({ card_variant: "framed" })
  })

  it("refuses a save naming one off the list, and reads a stored one as the setting's", () => {
    expect(issues({ home: [rail({ card_variant: "technical" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    const doc = readStoredLayout({ home: [rail({ ...ALWAYS, card_variant: "technical" })] })
    expect(doc.home[0]).toMatchObject({ type: "products", card_variant: null })
  })
})
