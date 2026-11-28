import { layoutDocument } from "../../../lib/storefront/layout"
import { headerLinked, layoutTargets, linksOf } from "../layout-check"

const CATEGORY = "pcat_01KSTRIP00000000000000000"
const shop = { kind: "system" as const, target: "shop" as const, label: null }
const category = { kind: "category" as const, target: CATEGORY, label: null }

const header = (more: Record<string, unknown>) =>
  layoutDocument.parse({
    header: [{ id: "duyuru0001", type: "announcement_bar", lines: ["Bir", "İki"], ...more }],
  })

/** The top strip as a slider (owner 2026-11-27): its lines' own links are checked as its button. */
describe("the top strip's links", () => {
  it("holds its button and each line's own link, none for a line of words", () => {
    const doc = header({ link: shop, line_links: [null, category] })
    const [bar] = doc.header
    expect(bar && linksOf(bar)).toEqual([shop, category])
    expect(headerLinked(doc)).toHaveLength(1)
    expect(layoutTargets(doc)).toEqual([{ part: "duyuru0001", kind: "category", target: CATEGORY }])
  })

  it("is not read for links when it has none", () => {
    expect(headerLinked(header({}))).toEqual([])
    expect(headerLinked(header({ line_links: [null, null] }))).toEqual([])
    expect(headerLinked(header({ line_links: [shop] }))).toHaveLength(1)
  })
})

describe("the top image slider's links", () => {
  it("holds each slide's link and is read for links only with one", () => {
    const image = { url: "/static/a.webp", alt: "Kampanya" }
    const doc = layoutDocument.parse({
      header: [
        {
          id: "kaydirici01",
          type: "top_slider",
          slides: [{ image }, { image, link: category }],
        },
      ],
    })
    const [slider] = doc.header
    expect(slider && linksOf(slider)).toEqual([category])
    expect(headerLinked(doc)).toHaveLength(1)
    const bare = layoutDocument.parse({
      header: [{ id: "kaydirici01", type: "top_slider", slides: [{ image }] }],
    })
    expect(headerLinked(bare)).toEqual([])
  })
})
