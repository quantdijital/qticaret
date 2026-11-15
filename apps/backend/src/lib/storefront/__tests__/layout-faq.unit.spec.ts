import path from "node:path"
import { layoutDocument } from "../layout"
import { FAQ_DEFAULTS, FAQ_SETTINGS } from "../sections/faq"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-faq.ts"
)

const faq = (more: Record<string, unknown> = {}) => ({
  id: "sssbolumu",
  type: "faq",
  title: null,
  items: [{ question: "Kargo ne zaman?", answer: "Aynı gün." }],
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the FAQ section's settings (bilesen-denetimi (b) 8)", () => {
  it("reads a section saved before them as it was drawn: all closed, each on its own", () => {
    const doc = layoutDocument.parse({ home: [faq()] })

    expect(doc.home[0]).toMatchObject({ open_first: "off", single_open: "off" })
    expect(FAQ_DEFAULTS).toEqual({ open_first: "off", single_open: "off" })
  })

  it("keeps the shop's steps as saved, on every page that takes the section", () => {
    const set = { open_first: "on", single_open: "on" }
    const doc = layoutDocument.parse({
      home: [faq(set)],
      product: [faq({ id: "sssurun001", single_open: "on" })],
      category: [faq({ id: "ssskategori", open_first: "on", placement: "top" })],
    })

    expect(doc.home[0]).toMatchObject(set)
    expect(doc.product[0]).toMatchObject({ open_first: "off", single_open: "on" })
    expect(doc.category[0]).toMatchObject({ open_first: "on", single_open: "off" })
  })

  it("refuses a step off its list with the section's error key", () => {
    expect(issues({ home: [faq({ open_first: true })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [faq({ single_open: "always" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(FAQ_SETTINGS).toEqual(contract["FAQ_SETTINGS"])
    expect(FAQ_DEFAULTS).toEqual(contract["FAQ_DEFAULTS"])
  })
})
