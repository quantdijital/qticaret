import path from "node:path"
import { layoutDocument } from "../layout"
import { ANNOUNCEMENT_DEFAULTS, ANNOUNCEMENT_SETTINGS } from "../sections/announcement-bar"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-announcement.ts"
)

const bar = (more: Record<string, unknown> = {}) => ({
  id: "duyuru0001",
  type: "announcement_bar",
  lines: ["Kargo bedava", "Aynı gün kargo"],
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the announcement bar's settings (bilesen-denetimi (b) 6)", () => {
  it("reads a bar saved before them as it was drawn: the first line alone", () => {
    const doc = layoutDocument.parse({ header: [bar()] })

    expect(doc.header[0]).toEqual({
      ...bar(),
      visible: true,
      starts_at: null,
      ends_at: null,
      ...ANNOUNCEMENT_DEFAULTS,
    })
    expect(ANNOUNCEMENT_DEFAULTS.mode).toBe("first")
  })

  it("keeps the shop's steps as saved", () => {
    const set = { mode: "rotate", interval: "slow", pause_button: "hover", hover_pause: "off" }
    const doc = layoutDocument.parse({ header: [bar(set)] })

    expect(doc.header[0]).toMatchObject(set)
    expect(layoutDocument.parse({ header: [bar({ mode: "inline" })] }).header[0]).toMatchObject({
      mode: "inline",
      interval: "medium",
    })
  })

  it("refuses a step off its list, and never a bar without its pause button", () => {
    expect(issues({ header: [bar({ mode: "marquee" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ header: [bar({ pause_button: "none" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ header: [bar({ interval: 5 })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(ANNOUNCEMENT_SETTINGS).toEqual(contract["ANNOUNCEMENT_SETTINGS"])
    expect(ANNOUNCEMENT_DEFAULTS).toEqual(contract["ANNOUNCEMENT_DEFAULTS"])
  })
})
