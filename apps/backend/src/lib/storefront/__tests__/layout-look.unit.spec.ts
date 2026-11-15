import path from "node:path"
import { layoutDocument, readStoredLayout } from "../layout"
import { SECTION_LOOK, hasLook, storedLook } from "../sections/look"
import { storedSection } from "../sections/stored"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-look.ts"
)

// Every body section shows on every screen unless the shop picks one (bilesen-standardi §2)
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const NONE = { space_outer: null, space_inner: null, ground: null, align: null, width: null }
const faq = (more: Record<string, unknown> = {}) => ({
  id: "sssbolumu",
  type: "faq",
  title: null,
  items: [{ question: "Kargo ne zaman?", answer: "Aynı gün." }],
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("a section's look (adr/0049 Ek 2026-11-14 §6)", () => {
  it("reads a section saved before looks as it was: no look, the theme's own drawing", () => {
    const doc = layoutDocument.parse({ home: [faq()] })

    expect(doc.home).toEqual([{ ...faq(), ...ALWAYS }])
    expect(doc.home[0]).not.toHaveProperty("look")
  })

  it("keeps the steps the shop set, the others the theme's own, on every page", () => {
    const doc = layoutDocument.parse({
      home: [faq({ look: { ground: "well", space_outer: "none" } })],
      product: [faq({ id: "urunsss01", look: { width: "narrow" } })],
      category: [
        { id: "kategoriguven", type: "trust_badges", look: { align: "center" }, placement: "top" },
      ],
    })

    expect(doc.home[0]).toMatchObject({ look: { ...NONE, ground: "well", space_outer: "none" } })
    expect(doc.product[0]).toMatchObject({ look: { ...NONE, width: "narrow" } })
    expect(doc.category[0]).toMatchObject({
      variant: "strip",
      placement: "top",
      look: { ...NONE, align: "center" },
    })
  })

  it("refuses a step off a list, a field no look has, or a look that is not one", () => {
    expect(issues({ home: [faq({ look: { ground: "red" } })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [faq({ look: { padding: "large" } })] })).toHaveLength(1)
    expect(issues({ home: [faq({ look: { space_inner: 24 } })] })).toHaveLength(1)
    expect(issues({ home: [faq({ look: "wide" })] })).toHaveLength(1)
  })

  it("is a body section's only: the header's bar and the footer's box take none", () => {
    const bar = { id: "duyuru0001", type: "announcement_bar", lines: ["Kargo bedava"] }
    const box = { id: "bulten0001", type: "newsletter", title: null, text: null }

    expect(issues({ header: [{ ...bar, look: { ground: "stage" } }] })).toHaveLength(1)
    expect(issues({ footer: [{ ...box, look: { ground: "stage" } }] })).toHaveLength(1)
    expect(issues({ home: [{ ...box, look: { ground: "stage" } }] })).toEqual([])
  })

  it("reads a stored step taken off its list, or a field it never had, as the theme's own", () => {
    const stored = {
      home: [faq({ ...ALWAYS, look: { ground: "neon", width: "full", sparkle: true } })],
      product: [faq({ id: "urunsss01", ...ALWAYS, look: "broken" })],
    }

    const doc = readStoredLayout(stored)

    expect(doc.home[0]).toMatchObject({ look: { ...NONE, width: "full" } })
    expect(doc.product[0]).not.toHaveProperty("look")
    // A save of the same document is still held to the lists
    expect(layoutDocument.safeParse(stored).success).toBe(false)
  })

  it("keeps a look on its lists, and a section without one, as they are", () => {
    const listed = faq({ look: { ...NONE, ground: "stage" } })
    const plain = faq()

    expect(storedLook(listed)).toBe(listed)
    expect(storedLook(plain)).toBe(plain)
    expect(storedSection(listed)).toBe(listed)
  })

  it("keeps the look of a trust strip whose variant is read as the default", () => {
    const stored = {
      id: "guvenserit",
      type: "trust_badges",
      ...ALWAYS,
      variant: "removed_one",
      look: { space_outer: "large" },
    }

    expect(storedSection(stored)).toEqual({ ...stored, variant: "strip" })
  })

  it("prints a look only when the shop set a step", () => {
    expect(hasLook(undefined)).toBe(false)
    expect(hasLook(NONE)).toBe(false)
    expect(hasLook({ ...NONE, align: "center" })).toBe(true)
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const contract = jest.requireActual<{ SECTION_LOOK: unknown }>(CONTRACT_FILE)
    expect(SECTION_LOOK).toEqual(contract.SECTION_LOOK)
  })
})
