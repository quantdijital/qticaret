import type { MedusaContainer } from "@medusajs/framework/types"
import { publishedPageLayout } from "../layout-page-read"
import { publishedDocument } from "../layout-published"
import { layoutEdition, layoutRow } from "../layout-row"
import type { LayoutEdition } from "../layout-row"

/**
 * Security review 2026-11-19 (S2): a public read looks its cache up with
 * the live revision alone; the design record and its documents are read
 * once per revision, and a page the design does not lay out takes no
 * cache entry and no hydration. Second review: the key carries the moment
 * the revision went live, so a number a rolled-back publication gave back
 * never serves that publication's document.
 */

jest.mock("../layout-row", () => ({
  ...jest.requireActual<Record<string, unknown>>("../layout-row"),
  layoutEdition: jest.fn(),
  layoutRow: jest.fn(),
}))

const PAGE = "cnt_01KABOUT0000000000000000"
const AT = "2026-11-19T09:00:00.000Z"
const container = {} as MedusaContainer
const published = (revision: number, title = "Hakkımızda") => ({
  id: "sfl_1",
  revision,
  published_at: new Date(AT),
  published: { home: [{ id: "yardim001", type: "help", title }] },
  draft: {},
})
const live = (revision: number, at: string | null = AT): LayoutEdition => ({
  id: "sfl_1",
  revision,
  published: at !== null,
  published_at: at,
})

const edition = jest.mocked(layoutEdition)
const row = jest.mocked(layoutRow)

describe("the published design read once per revision", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("reads the record on the first ask for a revision only", async () => {
    row.mockResolvedValue(published(101) as never)
    const first = await publishedDocument(container, live(101))
    const again = await publishedDocument(container, live(101))
    expect(again).toBe(first)
    expect(row).toHaveBeenCalledTimes(1)
    row.mockResolvedValue(published(102) as never)
    await publishedDocument(container, live(102))
    expect(row).toHaveBeenCalledTimes(2)
  })

  it("reads again a revision number that went live at another moment", async () => {
    // A publication read, then rolled back: the next one takes its number again
    row.mockResolvedValue(published(301, "Geri alınan") as never)
    const failed = await publishedDocument(container, live(301))
    row.mockResolvedValue(published(301, "Yayındaki") as never)
    const next = await publishedDocument(container, live(301, "2026-11-19T09:05:00.000Z"))
    expect(row).toHaveBeenCalledTimes(2)
    expect(failed.home[0]).toMatchObject({ title: "Geri alınan" })
    expect(next.home[0]).toMatchObject({ title: "Yayındaki" })
  })

  it("answers a page the live design does not lay out without hydrating or a second read", async () => {
    edition.mockResolvedValue(live(201))
    row.mockResolvedValue(published(201) as never)
    expect(await publishedPageLayout(container, PAGE, null)).toBeNull()
    expect(await publishedPageLayout(container, PAGE, ["sc_1"])).toBeNull()
    expect(row).toHaveBeenCalledTimes(1)
  })

  it("reads nothing more than the revision while nothing is published", async () => {
    edition.mockResolvedValue(live(0, null))
    expect(await publishedPageLayout(container, PAGE, null)).toBeNull()
    expect(row).not.toHaveBeenCalled()
  })
})
