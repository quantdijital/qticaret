import type { MedusaContainer } from "@medusajs/framework/types"
import { layoutDocument } from "../../../lib/storefront/layout"
import { prunePages } from "../layout-pages"

const ABOUT = "cnt_01KABOUT0000000000000000"
const GONE = "cnt_01KGONE00000000000000000"
const help = (id: string) => ({ id, type: "help" })

/** A container whose content module holds these entries (a deleted one is not listed). */
function containerWith(entries: { id: string; kind: "page" | "post" }[]) {
  const listContentEntries = jest.fn((filter: { id: string[] }) =>
    Promise.resolve(entries.filter((entry) => filter.id.includes(entry.id)))
  )
  const container = {
    resolve: jest.fn(() => ({ listContentEntries })),
  } as unknown as MedusaContainer
  return { container, listContentEntries }
}

describe("the design's content page layouts held to the pages there are (adr/0073 §1)", () => {
  it("asks nothing of a design without page layouts", async () => {
    const { container, listContentEntries } = containerWith([])
    const doc = layoutDocument.parse({ home: [help("yardim001")] })
    expect(await prunePages(container, doc)).toEqual({ document: doc, dropped_pages: 0 })
    expect(listContentEntries).not.toHaveBeenCalled()
  })

  it("leaves out a deleted page's layout and says how many went, keeping the rest", async () => {
    const { container } = containerWith([{ id: ABOUT, kind: "page" }])
    const doc = layoutDocument.parse({
      pages: [
        { page_id: GONE, sections: [help("yardim001")] },
        { page_id: ABOUT, sections: [help("yardim002")] },
      ],
    })
    const pruned = await prunePages(container, doc)
    expect(pruned.dropped_pages).toBe(1)
    expect(pruned.document.pages.map((page) => page.page_id)).toEqual([ABOUT])
  })

  it("keeps the design as it is when every page is there", async () => {
    const { container } = containerWith([{ id: ABOUT, kind: "page" }])
    const doc = layoutDocument.parse({ pages: [{ page_id: ABOUT, sections: [help("yardim001")] }] })
    const pruned = await prunePages(container, doc)
    expect(pruned).toEqual({ document: doc, dropped_pages: 0 })
  })

  it("refuses a layout naming a blog post: a stale or forged editor", async () => {
    const { container } = containerWith([{ id: ABOUT, kind: "post" }])
    const doc = layoutDocument.parse({ pages: [{ page_id: ABOUT, sections: [help("yardim001")] }] })
    await expect(prunePages(container, doc)).rejects.toMatchObject({
      safeMessage: "storefront_layout.page_invalid",
      field: "document.pages",
    })
  })
})
