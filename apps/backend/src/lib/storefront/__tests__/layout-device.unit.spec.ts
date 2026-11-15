import path from "node:path"
import { hydrateMarquee, hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import { SECTION_DEVICES } from "../layout-fields"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-device.ts"
)

const strip = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "marquee",
  items: [{ text: "Kargo bedava" }],
  ...more,
})
const faq = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "faq",
  title: null,
  items: [{ question: "Kargo?", answer: "Ertesi gün." }],
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const at = { values: {}, links: new Map(), images: new Map() } as unknown as HydrateContext

describe("which screens show a section (docs/tema/bilesen-standardi §2, O1)", () => {
  it("shows every body section everywhere unless the shop picks a screen", () => {
    const doc = layoutDocument.parse({
      home: [faq("sss0000001"), faq("sss0000002", { device: "mobile" })],
      product: [faq("sss0000003", { device: "desktop" })],
      category: [faq("sss0000004", { placement: "top" })],
    })

    expect(doc.home.map((section) => section.device)).toEqual(["all", "mobile"])
    expect(doc.product[0]).toMatchObject({ device: "desktop" })
    expect(doc.category[0]).toMatchObject({ device: "all" })
  })

  it("reads a strip's saved screens as they are, on a page and in the header", () => {
    const doc = layoutDocument.parse({
      header: [strip("kayan00000", { device: "desktop" })],
      home: [strip("kayan00001", { device: "mobile" })],
    })

    expect(doc.header[0]).toMatchObject({ device: "desktop" })
    expect(doc.home[0]).toMatchObject({ device: "mobile" })
  })

  it("refuses a step off the list with the section's error key", () => {
    expect(issues({ home: [faq("sss0000001", { device: "tablet" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ header: [strip("kayan00000", { device: true })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("prints the screens only when not everywhere, so a section reads as before", async () => {
    const doc = layoutDocument.parse({
      header: [strip("kayan00000", { device: "mobile" })],
      home: [faq("sss0000001"), faq("sss0000002", { device: "desktop" })],
    })
    const [everywhere, wide] = doc.home
    const [header] = doc.header

    expect(everywhere && (await hydrateSection(everywhere, at))).not.toHaveProperty("device")
    expect(wide && (await hydrateSection(wide, at))).toMatchObject({ device: "desktop" })
    expect(header?.type === "marquee" && hydrateMarquee(header, at)).toMatchObject({
      device: "mobile",
    })
  })

  it("mirrors the contract's list: a step goes there first", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(SECTION_DEVICES).toEqual(contract["SECTION_DEVICES"])
  })
})
