import path from "node:path"
import { layoutDocument, readStoredLayout } from "../layout"
import { mainSectionsOf } from "../layout-main"
import { HEADER_TOOL_LABELS } from "../sections/main"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-variants.ts"
)

const header = (fields: Record<string, unknown>) => ({
  header: [{ id: "mainheader", type: "header_bar", variant: "inline", ...fields }],
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the one-row header's tools with words or as icons (adr/0066 §2)", () => {
  it("reads a header bar saved without it as drawn before: with words", () => {
    const old = readStoredLayout(header({ sticky: true }))
    expect(old.header[0]).toMatchObject({ variant: "inline", tool_labels: "show" })
    expect(mainSectionsOf(old).header_bar).toMatchObject({ tool_labels: "show" })
  })

  it("keeps each step through a save and the storefront's answer", () => {
    for (const step of HEADER_TOOL_LABELS) {
      const doc = layoutDocument.parse(header({ tool_labels: step }))
      expect(doc.header[0]).toMatchObject({ tool_labels: step })
      expect(mainSectionsOf(doc).header_bar).toMatchObject({ tool_labels: step })
    }
  })

  it("refuses a save with a step off the list, and reads a stored one as with words", () => {
    for (const stray of [true, "icons", "", null, 1]) {
      expect(issues(header({ tool_labels: stray }))).toContain("storefront_layout.section_invalid")
    }
    const doc = readStoredLayout(header({ sticky: false, tool_labels: "drawer" }))
    expect(doc.header[0]).toMatchObject({ sticky: false, tool_labels: "show" })
  })

  it("mirrors the contract's steps", () => {
    const contract = jest.requireActual<{ HEADER_TOOL_LABELS: unknown }>(CONTRACT_FILE)
    expect(HEADER_TOOL_LABELS).toEqual(contract.HEADER_TOOL_LABELS)
  })
})
