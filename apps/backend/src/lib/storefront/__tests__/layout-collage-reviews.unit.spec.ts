import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { imagesOf, linksOf } from "../../../workflows/storefront/layout-check"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import type { BodySection } from "../layout"
import {
  PHOTO_COLLAGE_DEFAULTS,
  PHOTO_COLLAGE_LIMITS,
  PHOTO_COLLAGE_SETTINGS,
  photoCollage,
} from "../sections/photo-collage"
import { reviews } from "../sections/reviews"
import { storedSection } from "../sections/stored"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = (file: string) =>
  jest.requireActual<Record<string, unknown>>(
    path.resolve(__dirname, `../../../../../../packages/types/src/store/${file}.ts`)
  )

const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const PAGE = "cnt_01KABOUT0000000000000000"
const URL = "https://cdn.example.com/media/atolye"
const photo = (n: number, more = {}) => ({
  image: { url: `${URL}-${String(n)}.jpg`, alt: `Atölyeden görünüm ${String(n)}` },
  ...more,
})
const collage = (more: Record<string, unknown> = {}) => ({
  id: "kolaj01",
  type: "photo_collage",
  items: [photo(1), photo(2), photo(3)],
  ...more,
})
const quotes = (more: Record<string, unknown> = {}) => ({
  id: "yorumlar01",
  type: "reviews",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the photo collage (adr/0077 §10)", () => {
  it("takes a new collage with its default steps, on the home page and a content page", () => {
    const doc = layoutDocument.parse({
      home: [collage()],
      pages: [{ page_id: PAGE, sections: [collage({ id: "kolaj02" })] }],
    })

    expect(doc.home[0]).toEqual({
      ...collage(),
      ...ALWAYS,
      title: null,
      intro: null,
      items: [1, 2, 3].map((n) => ({ ...photo(n), caption: null, link: null })),
      layout: "asymmetric",
      phone: "scroll",
    })
    expect(doc.pages[0]?.sections[0]).toMatchObject({ type: "photo_collage", layout: "asymmetric" })
  })

  it("holds three to seven photographs, each with its words written", () => {
    const eight = Array.from({ length: PHOTO_COLLAGE_LIMITS.items.max + 1 }, (_, n) => photo(n))
    expect(issues({ home: [collage({ items: eight.slice(0, 2) })] })).not.toEqual([])
    expect(issues({ home: [collage({ items: eight })] })).not.toEqual([])
    expect(issues({ home: [collage({ items: eight.slice(0, 7) })] })).toEqual([])
    const unnamed = { image: { url: `${URL}-9.jpg`, alt: null } }
    const blank = { image: { url: `${URL}-9.jpg`, alt: "  " } }
    expect(issues({ home: [collage({ items: [photo(1), photo(2), unnamed] })] })).not.toEqual([])
    expect(issues({ home: [collage({ items: [photo(1), photo(2), blank] })] })).not.toEqual([])
  })

  it("refuses a step off its list, a stray field, an address off the library", () => {
    expect(issues({ home: [collage({ layout: "bento" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [collage({ phone: "grid" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(
      issues({ home: [collage({ items: [photo(1, { rank: 1 }), photo(2), photo(3)] })] })
    ).not.toEqual([])
    const outside = { image: { url: "javascript:alert(1)", alt: "x" } }
    expect(issues({ home: [collage({ items: [photo(1), photo(2), outside] })] })).toContain(
      "storefront_layout.image_invalid"
    )
  })

  it("is not offered on a product or a category page", () => {
    expect(issues({ product: [collage()] })).toContain("storefront_layout.section_invalid")
    expect(issues({ category: [collage({ placement: "top" })] })).toContain(
      "storefront_layout.section_invalid"
    )
  })

  it("names its pictures and its photographs' links for the checks", () => {
    const shop = { kind: "system", target: "shop", label: null } as const
    const section = photoCollage.parse(
      collage({ items: [photo(1, { link: shop }), photo(2), photo(3)] })
    ) as BodySection
    expect(imagesOf(section)).toEqual([1, 2, 3].map((n) => `${URL}-${String(n)}.jpg`))
    expect(linksOf(section)).toEqual([shop])
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const own = contract("section-collage")
    expect(PHOTO_COLLAGE_SETTINGS).toEqual(own["PHOTO_COLLAGE_SETTINGS"])
    expect(PHOTO_COLLAGE_DEFAULTS).toEqual(own["PHOTO_COLLAGE_DEFAULTS"])
    expect(PHOTO_COLLAGE_LIMITS).toEqual(own["PHOTO_COLLAGE_LIMITS"])
  })
})

describe("the reviews' variants (adr/0077 §10)", () => {
  it("reads a saved section without a variant as today's grid, nothing else added", () => {
    const doc = layoutDocument.parse({ home: [quotes({ title: null, limit: 6 })] })
    expect(doc.home[0]).toEqual({ ...quotes(), ...ALWAYS, title: null, limit: 6, variant: "grid" })
  })

  it("takes a carousel with the scroller kit's defaults, refuses an unknown variant", () => {
    const doc = layoutDocument.parse({ home: [quotes({ variant: "carousel" })] })
    expect(doc.home[0]).toMatchObject({
      variant: "carousel",
      limit: 6,
      scroller: { desktop: "four", arrows: "always" },
    })
    expect(issues({ home: [quotes({ variant: "wall" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    // A grid holds no scroller
    expect(issues({ home: [quotes({ scroller: {} })] })).not.toEqual([])
  })

  it("reads a variant off the list as the grid, keeping only the grid's fields", () => {
    expect(storedSection(quotes({ variant: "wall", limit: 4, scroller: {} }))).toEqual(
      quotes({ variant: "grid", limit: 4 })
    )
  })
})

describe("the collage and the reviews on the storefront", () => {
  const container = {} as MedusaContainer
  const values = {
    mağaza_adı: "Atölye",
    telefon: null,
    e_posta: null,
    adres: null,
    whatsapp: null,
    ücretsiz_kargo_eşiği: null,
  }
  const context = (links = new Map<unknown, unknown>()) =>
    ({ values, images: new Map(), links, container }) as unknown as HydrateContext

  it("prints a grid of reviews as before the variants, a carousel with its scroller", async () => {
    const grid = await hydrateSection(reviews.parse(quotes()), context())
    expect(grid).toEqual({ id: "yorumlar01", type: "reviews", title: null, limit: 6 })

    const carousel = await hydrateSection(
      reviews.parse(quotes({ variant: "carousel", scroller: { desktop: "three" } })),
      context()
    )
    expect(carousel).toMatchObject({ variant: "carousel", scroller: { desktop: "three" } })
  })

  it("prints the photographs with their own words, captions filled, links placed", async () => {
    const shop = { kind: "system", target: "shop", label: null } as const
    const placed = { label: null, kind: "system", target: "shop", path: null }
    const section = photoCollage.parse(
      collage({
        intro: "{mağaza_adı} atölyesinden",
        items: [photo(1, { caption: "{mağaza_adı} tezgâhı", link: shop }), photo(2), photo(3)],
        layout: "even",
      })
    ) as BodySection & { items: { link: unknown }[] }
    const shown = await hydrateSection(
      section,
      context(new Map([[section.items[0]?.link, placed]]))
    )

    expect(shown).toMatchObject({
      type: "photo_collage",
      intro: "Atölye atölyesinden",
      layout: "even",
      phone: "scroll",
      items: [
        {
          image: { url: `${URL}-1.jpg`, alt: "Atölyeden görünüm 1", width: null },
          caption: "Atölye tezgâhı",
          link: placed,
        },
        { caption: null, link: null },
        { caption: null, link: null },
      ],
    })
  })
})
