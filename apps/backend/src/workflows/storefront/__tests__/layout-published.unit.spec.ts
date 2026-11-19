import type { MedusaContainer } from "@medusajs/framework/types"
import { publishedPageLayout } from "../layout-page-read"
import { publishedDocument } from "../layout-published"
import { layoutEdition, layoutRow } from "../layout-row"

/**
 * Security review 2026-11-19 (S2): a public read looks its cache up with
 * the live revision alone; the design record and its documents are read
 * once per revision, and a page the design does not lay out takes no
 * cache entry and no hydration.
 */

jest.mock("../layout-row", () => ({
  layoutEdition: jest.fn(),
  layoutRow: jest.fn(),
}))

const PAGE = "cnt_01KABOUT0000000000000000"
const container = {} as MedusaContainer
const published = (revision: number) => ({
  id: "sfl_1",
  revision,
  published_at: new Date(),
  published: { pages: [] },
  draft: {},
})

const edition = jest.mocked(layoutEdition)
const row = jest.mocked(layoutRow)

describe("the published design read once per revision", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("reads the record on the first ask for a revision only", async () => {
    row.mockResolvedValue(published(101) as never)
    const first = await publishedDocument(container, {
      id: "sfl_1",
      revision: 101,
      published: true,
    })
    const again = await publishedDocument(container, {
      id: "sfl_1",
      revision: 101,
      published: true,
    })
    expect(again).toBe(first)
    expect(row).toHaveBeenCalledTimes(1)
    row.mockResolvedValue(published(102) as never)
    await publishedDocument(container, { id: "sfl_1", revision: 102, published: true })
    expect(row).toHaveBeenCalledTimes(2)
  })

  it("answers a page the live design does not lay out without hydrating or a second read", async () => {
    edition.mockResolvedValue({ id: "sfl_1", revision: 201, published: true })
    row.mockResolvedValue(published(201) as never)
    expect(await publishedPageLayout(container, PAGE, null)).toBeNull()
    expect(await publishedPageLayout(container, PAGE, ["sc_1"])).toBeNull()
    expect(row).toHaveBeenCalledTimes(1)
  })

  it("reads nothing more than the revision while nothing is published", async () => {
    edition.mockResolvedValue({ id: "sfl_1", revision: 0, published: false })
    expect(await publishedPageLayout(container, PAGE, null)).toBeNull()
    expect(row).not.toHaveBeenCalled()
  })
})
