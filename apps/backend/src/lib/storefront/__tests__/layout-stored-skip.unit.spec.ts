import { layoutDocument, readStoredLayout, storedDocument } from "../layout"
import { logger } from "../../logging"
import { AdminPostStorefrontLayout } from "../../../api/admin/storefront-layout/validators"

// A section type no build reads (taken off since, or written by a newer one)
const unknown = { id: "gelecekbolum", type: "future_section", secret_text: "not for the log" }
const badges = (id: string) => ({ id, type: "trust_badges" })

describe("a stored design with a section its group does not read (D2)", () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it("reads the rest of the design, skipping that section", () => {
    const doc = readStoredLayout({
      home: [badges("ilkbolum"), unknown, badges("sonbolum")],
      product: [{ id: "bozukbolum", type: "trust_badges", variant: "strip", visible: "yes" }],
    })

    expect(doc.home.map((section) => section.id)).toEqual(["ilkbolum", "sonbolum"])
    expect(doc.product).toEqual([])
  })

  it("says so once, with the group, id and type but not the content", () => {
    readStoredLayout({
      home: [unknown, "broken row"],
      footer: [{ ...unknown, id: "altgelecekbolum" }],
    })

    expect(warn).toHaveBeenCalledTimes(1)
    const [fields] = warn.mock.calls[0] as [Record<string, unknown>]
    expect(fields).toEqual({
      event: "storefront.layout_section_skipped",
      sections: [
        { group: "home", id: "gelecekbolum", type: "future_section" },
        { group: "home", id: null, type: null },
        { group: "footer", id: "altgelecekbolum", type: "future_section" },
      ],
    })
    expect(JSON.stringify(fields)).not.toContain("not for the log")
  })

  it("logs nothing when every section reads", () => {
    readStoredLayout({ home: [badges("ilkbolum")] })

    expect(warn).not.toHaveBeenCalled()
  })

  it("gives a document that is not one as it is, for the schema to refuse", () => {
    expect(storedDocument("not a document")).toBe("not a document")
    expect(() => readStoredLayout("not a document")).toThrow()
    expect(() => readStoredLayout(null)).toThrow()
  })

  it("still refuses that section on a save", () => {
    const doc = { home: [badges("ilkbolum"), unknown] }

    expect(layoutDocument.safeParse(doc).success).toBe(false)
    expect(AdminPostStorefrontLayout.safeParse({ document: doc }).success).toBe(false)
  })
})
