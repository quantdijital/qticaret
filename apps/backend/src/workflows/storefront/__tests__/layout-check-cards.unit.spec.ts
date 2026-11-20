import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { layoutDocument } from "../../../lib/storefront/layout"
import { MEDIA_MODULE } from "../../../modules/media"
import { checkLayout } from "../layout-check"

/**
 * The card rule of a design's save (adr/0073 Ek 2026-11-19 (2) K2): as a
 * content save checks a text, only the cards the save adds are checked;
 * a card saved before whose record went since does not lock the editor.
 */

const PAGE = "cnt_01KABOUT0000000000000000"
const id = (prefix: string, seed: string) => `${prefix}_${seed.padEnd(26, "0")}`
const KEPT = id("prod", "01KKEPT")
const GONE = id("prod", "01KGONE")
const NEW_GONE = id("prod", "01KNEWGONE")
const CATEGORY = id("pcat", "01KCATEGORY")

const card = (type: "productCard" | "categoryCard", ref: string) => ({ type, attrs: { id: ref } })

/** A design whose page holds an article and a contact section with these cards. */
const design = (article: unknown[], contact: unknown[] = []) =>
  layoutDocument.parse({
    pages: [
      {
        page_id: PAGE,
        sections: [
          {
            id: "metin00001",
            type: "rich_text",
            variant: "article",
            body: { type: "doc", content: article },
          },
          ...(contact.length > 0
            ? [{ id: "iletisim01", type: "contact", body: { type: "doc", content: contact } }]
            : []),
        ],
      },
    ],
  })

/** A container whose catalogue holds `KEPT` and `CATEGORY` only. */
function container() {
  const listProducts = jest.fn(({ id }: { id: string[] }) =>
    Promise.resolve(id.filter((each) => each === KEPT).map((each) => ({ id: each })))
  )
  const listProductCategories = jest.fn(({ id }: { id: string[] }) =>
    Promise.resolve(id.filter((each) => each === CATEGORY).map((each) => ({ id: each })))
  )
  const resolve = (key: string) => {
    if (key === ContainerRegistrationKeys.QUERY) {
      return { graph: jest.fn(() => Promise.resolve({ data: [] })) }
    }
    if (key === Modules.PRODUCT) {
      return { listProducts, listProductCategories }
    }
    if (key === MEDIA_MODULE) {
      // The library holds no picture at all
      return { listMediaAssets: jest.fn(() => Promise.resolve([])) }
    }
    throw new Error(`unexpected ${key}`)
  }
  return { container: { resolve } as never, listProducts, listProductCategories }
}

describe("checkLayout's cards (adr/0073 Ek 2026-11-19 (2) K2)", () => {
  it("passes a card the stored design held whose record went since", async () => {
    const before = design([card("productCard", GONE)])
    const next = design([card("productCard", GONE), card("productCard", KEPT)])
    const { container: c, listProducts } = container()

    await expect(checkLayout(c, next, before)).resolves.toEqual([])
    // Only the card the save adds was asked for
    expect(listProducts).toHaveBeenCalledTimes(1)
    expect(listProducts.mock.calls[0]?.[0]).toEqual({ id: [KEPT] })
  })

  it("refuses a card the save adds whose record does not exist, in a contact text too", async () => {
    const before = design([card("productCard", GONE)])
    const added = design([card("productCard", GONE)], [card("productCard", NEW_GONE)])

    await expect(checkLayout(container().container, added, before)).rejects.toMatchObject({
      safeMessage: "content.card_unknown",
    })
  })

  it("checks every card of a design saved the first time, categories alike", async () => {
    const first = design([card("productCard", KEPT), card("categoryCard", CATEGORY)])
    const { container: c, listProductCategories } = container()

    await expect(checkLayout(c, first)).resolves.toEqual([])
    expect(listProductCategories.mock.calls[0]?.[0]).toEqual({ id: [CATEGORY] })
    await expect(
      checkLayout(container().container, design([card("productCard", GONE)]))
    ).rejects.toMatchObject({ safeMessage: "content.card_unknown" })
  })

  it("takes a page's text placed from what it was as known: its gone card and picture alike", async () => {
    const picture = { type: "image", attrs: { src: "https://cdn.example.com/silinen.webp" } }
    // An older page's text placed from its mirror on a save (`carried`): not the save's work
    const placed = design([card("productCard", GONE), picture])
    const carried = placed.pages[0]?.sections ?? []
    await expect(checkLayout(container().container, placed, null, carried)).resolves.toEqual([])
    // The same text as the save's own work is refused
    await expect(checkLayout(container().container, placed)).rejects.toMatchObject({
      safeMessage: "content.card_unknown",
    })
    await expect(checkLayout(container().container, design([picture]), null)).rejects.toMatchObject(
      { safeMessage: "content.image_unknown" }
    )
    // Saved before in a text: kept, as a card is (a later save, a publication)
    await expect(
      checkLayout(container().container, design([picture]), design([picture]))
    ).resolves.toEqual([])
  })

  it("asks for nothing when the design is its own known (a publication)", async () => {
    const live = design([card("productCard", GONE)])
    const { container: c, listProducts } = container()

    await expect(checkLayout(c, live, live)).resolves.toEqual([])
    expect(listProducts).not.toHaveBeenCalled()
  })
})
