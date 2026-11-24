import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { layoutDocument } from "../../../lib/storefront/layout"
import { MEDIA_MODULE } from "../../../modules/media"
import { checkLayout } from "../layout-check"
import { goneTargets } from "../layout-gone"
import { liveRecords } from "../layout-live"

// The storefront's live filter asks the links' resolver: every record but the kept one is broken
jest.mock("../menu-links", () => {
  const actual = jest.requireActual<Record<string, unknown>>("../menu-links")
  return {
    ...actual,
    resolveLinks: jest.fn((_container: unknown, links: { id: string }[]) =>
      Promise.resolve(
        new Map(
          links.map((link) => [
            link.id,
            { broken: link.id !== "category:pcat_01KKEPT000000000000000000" },
          ])
        )
      )
    ),
  }
})

/**
 * A design's records on saving ("engel değil uyarı"): a record the save
 * names anew must exist; one the stored design already named, deleted
 * since (a demo category gone with an import), neither refuses the save
 * nor any other change: the editor marks its section instead.
 */

const KEPT = "pcat_01KKEPT000000000000000000"
const GONE = "pcat_01KGONE000000000000000000"
const NEW_GONE = "pcat_01KNEWGONE00000000000000"

/** A home page whose category grid shows these categories, and a page's article beside. */
const design = (ids: string[]) =>
  layoutDocument.parse({
    home: [{ id: "kategoriler", type: "categories", category_ids: ids }],
    pages: [
      {
        page_id: "cnt_01KFAQ00000000000000000000",
        sections: [
          {
            id: "sssmetni01",
            type: "rich_text",
            variant: "article",
            body: { type: "doc", content: [{ type: "paragraph" }] },
          },
        ],
      },
    ],
  })

/** A container whose catalogue holds `KEPT` only. */
function container() {
  const graph = jest.fn(({ filters }: { filters?: { id?: string[] } }) =>
    Promise.resolve({
      data: (filters?.id ?? []).filter((id) => id === KEPT).map((id) => ({ id })),
    })
  )
  const resolve = (key: string) => {
    if (key === ContainerRegistrationKeys.QUERY) {
      return { graph }
    }
    if (key === MEDIA_MODULE) {
      return { listMediaAssets: jest.fn(() => Promise.resolve([])) }
    }
    throw new Error(`unexpected ${key}`)
  }
  return { container: { resolve } as never, graph }
}

describe("checkLayout's records", () => {
  it("saves a change elsewhere while a section still names a record deleted since", async () => {
    const before = design([GONE, KEPT])
    // The shop edits the FAQ page's text; the home grid still names the gone category
    const next = design([GONE, KEPT])
    const { container: c, graph } = container()

    await expect(checkLayout(c, next, before)).resolves.toEqual([])
    // Nothing new named: nothing asked
    expect(graph).not.toHaveBeenCalled()
  })

  it("passes a stored raw draft (JSON as kept) as what was named before", async () => {
    const before: unknown = JSON.parse(JSON.stringify(design([GONE])))

    await expect(checkLayout(container().container, design([GONE, KEPT]), before)).resolves.toEqual(
      []
    )
  })

  it("refuses a record the save names anew that does not exist", async () => {
    const before = design([GONE])

    await expect(
      checkLayout(container().container, design([GONE, NEW_GONE]), before)
    ).rejects.toMatchObject({ safeMessage: "storefront_layout.target_unknown" })
  })

  it("checks every record of a design saved the first time", async () => {
    await expect(checkLayout(container().container, design([GONE]))).rejects.toMatchObject({
      safeMessage: "storefront_layout.target_unknown",
    })
    await expect(checkLayout(container().container, design([KEPT]))).resolves.toEqual([])
  })
})

describe("goneTargets", () => {
  it("names the sections whose record is gone, once each", async () => {
    await expect(goneTargets(container().container, design([GONE, KEPT, GONE]))).resolves.toEqual([
      "kategoriler",
    ])
    await expect(goneTargets(container().container, design([KEPT]))).resolves.toEqual([])
  })
})

describe("the storefront's draw of a gone record", () => {
  it("leaves the gone category out of a grid and an opening's tiles, the rest drawn", async () => {
    const doc = layoutDocument.parse({
      home: [
        { id: "kategoriler", type: "categories", category_ids: [GONE, KEPT] },
        {
          id: "katalogacilis",
          type: "hero",
          variant: "category_list",
          heading: "Bıçaklar",
          tiles: [
            { category_id: GONE, image: null },
            { category_id: KEPT, image: null },
          ],
        },
      ],
    })
    const keep = await liveRecords(container().container, doc.home)
    const [grid, opening] = keep(doc.home)

    expect(grid).toMatchObject({ id: "kategoriler", category_ids: [KEPT] })
    expect(opening).toMatchObject({
      id: "katalogacilis",
      tiles: [{ category_id: KEPT, image: null }],
    })
  })
})
