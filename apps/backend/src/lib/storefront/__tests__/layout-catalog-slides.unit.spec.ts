import path from "node:path"
import { imagesOf, linksOf } from "../../../workflows/storefront/layout-check"
import { hydrateHero } from "../../../workflows/storefront/layout-hydrate-catalog"
import { layoutDocument, readStoredLayout } from "../layout"
import { HERO_CATALOG_SLIDER_DEFAULTS } from "../sections/scroller"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT = path.resolve(__dirname, "../../../../../../packages/types/src/store")

const IMAGE = { url: "http://localhost:9000/static/kamp.webp", alt: null }
const SHOP = { kind: "system", target: "shop", label: null }
const hero = (more: Record<string, unknown> = {}) => ({
  id: "giris00001",
  type: "hero",
  variant: "category_list",
  heading: "Bıçaklar",
  ...more,
})
const issues = (more: Record<string, unknown>) =>
  layoutDocument.safeParse({ home: [hero(more)] }).error?.issues.map((each) => each.message) ?? []
const parsed = (more: Record<string, unknown>) => {
  const [section] = layoutDocument.parse({ home: [hero(more)] }).home
  if (section?.type !== "hero") {
    throw new Error("no hero")
  }
  return section
}

describe("the catalogue opening's slides (adr/0049 Ek 2026-11-15)", () => {
  it("reads an opening saved before slides as it was: no slides, no settings (no migration)", () => {
    const section = readStoredLayout({ home: [hero()] }).home[0]

    expect(section).not.toHaveProperty("slides")
    expect(section).not.toHaveProperty("scroller")
    expect(section).toMatchObject({ heading: "Bıçaklar", links: [], image: null })
  })

  it("fills a slide's missing fields, and the settings' missing steps with the opening's own", () => {
    const section = parsed({ slides: [{ image: IMAGE }], scroller: { dots: "off" } })

    expect(section).toMatchObject({
      slides: [{ image: IMAGE, heading: null, text: null, links: [], link: null }],
      scroller: { ...HERO_CATALOG_SLIDER_DEFAULTS, dots: "off", autoplay: "on" },
    })
  })

  it("refuses an empty slide, more than six, none, a step off the list and slides on today's opening", () => {
    const one = { image: IMAGE }

    expect(issues({ slides: [{}] })).toEqual(["storefront_layout.section_invalid"])
    expect(issues({ slides: Array.from({ length: 7 }, () => one) })).toHaveLength(1)
    expect(issues({ slides: [] })).toHaveLength(1)
    expect(issues({ slides: [one], scroller: { speed: "warp" } })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ slides: [one], scroller: { desktop: "four" } })).not.toEqual([])
    expect(issues({ slides: [{ ...one, links: [SHOP, SHOP, SHOP] }] })).toHaveLength(1)
    expect(issues({ variant: "standard", slides: [one] })).not.toEqual([])
    // Words without a picture, and a picture alone, are slides
    expect(issues({ slides: [{ heading: "Yeni" }, { image: IMAGE, link: SHOP }] })).toEqual([])
  })

  it("checks and resolves every slide's picture, buttons and picture link", () => {
    const section = parsed({
      slides: [
        { image: IMAGE, links: [SHOP] },
        { image: { ...IMAGE, url: `${IMAGE.url}?2` }, link: { ...SHOP, target: "cart" } },
      ],
    })

    expect(imagesOf(section)).toEqual([IMAGE.url, `${IMAGE.url}?2`])
    expect(linksOf(section).map((link) => ("target" in link ? link.target : null))).toEqual([
      "shop",
      "cart",
    ])
  })

  it("prints the slides and settings only when saved, their words filled and links placed", () => {
    const readers = {
      fill: (text: string | null) => (text === null ? null : text.toUpperCase()),
      link: (each: unknown) =>
        each ? { label: "Tümü", kind: "system" as const, target: "shop", path: null } : null,
      image: (url: string, alt: string | null) => ({
        url,
        alt,
        width: 800,
        height: 600,
        derivatives: null,
      }),
    }

    expect(hydrateHero(parsed({}), readers)).not.toHaveProperty("slides")
    expect(hydrateHero(parsed({}), readers)).not.toHaveProperty("scroller")
    expect(
      hydrateHero(parsed({ slides: [{ image: IMAGE, heading: "yeni", links: [SHOP] }] }), readers)
    ).toMatchObject({
      slides: [
        {
          image: { url: IMAGE.url, width: 800, alt: null },
          heading: "YENI",
          links: [{ label: "Tümü" }],
          link: null,
        },
      ],
    })
  })

  it("mirrors the contract's limits and the opening's slider defaults", () => {
    const scroller = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-scroller.ts`)
    expect(HERO_CATALOG_SLIDER_DEFAULTS).toEqual(scroller["HERO_CATALOG_SLIDER_DEFAULTS"])
  })
})
