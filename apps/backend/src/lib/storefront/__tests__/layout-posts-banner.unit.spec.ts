import path from "node:path"
import { imagesOf, linksOf } from "../../../workflows/storefront/layout-check"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument, readStoredLayout } from "../layout"
import {
  BANNER_EYEBROW_MAX,
  BANNER_SPLIT_BUTTON_TONES,
  BANNER_SPLIT_EDGES,
  BANNER_SPLIT_ORNAMENTS,
  banner,
} from "../sections/banner"
import { POSTS_INTRO_LIMITS, POSTS_PANEL_SETTINGS, posts } from "../sections/posts"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT = path.resolve(__dirname, "../../../../../../packages/types/src/store")

const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const WIDE = { url: "http://localhost:9000/static/vadi.webp", alt: "Vadi" }
const BLOG = { kind: "system", target: "blog", label: "Yazıları oku" } as const
const SHOP = { kind: "system", target: "shop", label: null } as const
const guides = (more: Record<string, unknown> = {}) => ({
  id: "yazilar01",
  type: "posts",
  title: "Gezi yazıları",
  limit: 3,
  ...more,
})
const band = (more: Record<string, unknown> = {}) => ({
  id: "kampanya1",
  type: "banner",
  slides: [{ image: WIDE, heading: "Sıradaki maceranız", link: SHOP }],
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const linked = (pairs: [unknown, unknown][]) =>
  ({ values: {}, images: new Map(), links: new Map(pairs) }) as unknown as HydrateContext

describe("the posts' intro panel (adr/0077 Ek, Vadi)", () => {
  it("reads posts saved before variants as today's grid, on the home and content pages", () => {
    const doc = layoutDocument.parse({ home: [guides()] })

    expect(doc.home).toEqual([{ ...guides(), ...ALWAYS, variant: "grid" }])
    expect(readStoredLayout({ home: [guides()] }).home[0]).toMatchObject({ variant: "grid" })
    // A variant off the list (a newer build's) reads as the grid, keeping the grid's fields only
    expect(
      readStoredLayout({ home: [guides({ variant: "mosaic", intro: "Yeni" })] }).home[0]
    ).toEqual({ ...guides(), ...ALWAYS, variant: "grid" })
  })

  it("takes the panel's upper line, intro and button, all optional", () => {
    expect(posts.parse(guides({ variant: "intro_panel" }))).toMatchObject({
      variant: "intro_panel",
      eyebrow: null,
      intro: null,
      link: null,
    })
    const full = posts.parse(
      guides({ variant: "intro_panel", eyebrow: "İlham mı lazım?", intro: "Rotalar", link: BLOG })
    )
    expect(full).toMatchObject({ eyebrow: "İlham mı lazım?", intro: "Rotalar", link: BLOG })
    expect(linksOf(full)).toEqual([BLOG])
  })

  it("refuses the panel's fields on the grid and words past their lengths", () => {
    // The upper line is every variant's since 2026-11-28 (`head-lines.ts`); the intro and button stay the panel's
    expect(issues({ home: [guides({ eyebrow: "Yeni" })] })).toEqual([])
    expect(issues({ home: [guides({ intro: "Yeni" })] }).length).toBeGreaterThan(0)
    const long = "a".repeat(POSTS_INTRO_LIMITS.intro + 1)
    expect(issues({ home: [guides({ variant: "intro_panel", intro: long })] }).length).toBe(1)
    expect(issues({ home: [guides({ variant: "intro_panel" })] })).toEqual([])
  })

  it("prints a grid as before variants and the panel with its words and placed button", async () => {
    expect(await hydrateSection(posts.parse(guides()), linked([]))).toEqual({
      id: "yazilar01",
      type: "posts",
      title: "Gezi yazıları",
      limit: 3,
    })
    const section = posts.parse(guides({ variant: "intro_panel", eyebrow: "İlham", link: BLOG }))
    const shown = { label: "Yazıları oku", kind: "system", target: "blog", path: null }
    const at = linked([[section.variant === "intro_panel" ? section.link : null, shown]])

    expect(await hydrateSection(section, at)).toEqual({
      id: "yazilar01",
      type: "posts",
      title: "Gezi yazıları",
      limit: 3,
      variant: "intro_panel",
      eyebrow: "İlham",
      intro: null,
      link: shown,
    })
  })

  it("mirrors the contract's lengths", () => {
    const contract = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-posts.ts`)
    expect(POSTS_INTRO_LIMITS).toEqual(contract["POSTS_INTRO_LIMITS"])
    expect(POSTS_PANEL_SETTINGS).toEqual(contract["POSTS_PANEL_SETTINGS"])
  })

  it("prints the panel's tone, leaves and wide covers only off their defaults", async () => {
    const plain = await hydrateSection(posts.parse(guides({ variant: "intro_panel" })), linked([]))
    expect(plain).not.toHaveProperty("panel_tone")
    expect(plain).not.toHaveProperty("ornament")
    expect(plain).not.toHaveProperty("cover_ratio")
    const set = posts.parse(
      guides({
        variant: "intro_panel",
        panel_tone: "tint",
        ornament: "leaves",
        cover_ratio: "wide",
      })
    )
    expect(await hydrateSection(set, linked([]))).toMatchObject({
      panel_tone: "tint",
      ornament: "leaves",
      cover_ratio: "wide",
    })
    expect(() => posts.parse(guides({ variant: "intro_panel", cover_ratio: "3:1" }))).toThrow()
  })
})

describe("the band's split variant (adr/0077 Ek, Vadi)", () => {
  it("takes the split on the home, product, category and content pages, its edge straight", () => {
    const doc = layoutDocument.parse({
      home: [band({ variant: "split" })],
      product: [band({ id: "urunbant1", variant: "split", edge: "curved" })],
      category: [band({ id: "katbant01", variant: "split", placement: "top" })],
    })

    expect(doc.home[0]).toMatchObject({ variant: "split", eyebrow: null, edge: "straight" })
    expect(doc.product[0]).toMatchObject({ variant: "split", edge: "curved" })
    expect(doc.category[0]).toMatchObject({ variant: "split", placement: "top" })
  })

  it("refuses an edge off its list, the split's fields on today's band, a long upper line", () => {
    expect(issues({ home: [band({ variant: "split", edge: "wavy" })] }).length).toBe(1)
    expect(issues({ home: [band({ edge: "curved" })] }).length).toBeGreaterThan(0)
    const long = "a".repeat(BANNER_EYEBROW_MAX + 1)
    expect(issues({ home: [band({ variant: "split", eyebrow: long })] }).length).toBe(1)
  })

  it("reads a split it does not know back as today's band, keeping the slides and steps", () => {
    const stored = band({ variant: "ribbon", eyebrow: "Fırsat", height: "high" })
    expect(readStoredLayout({ home: [stored] }).home[0]).toMatchObject({
      variant: "standard",
      height: "high",
    })
    expect(readStoredLayout({ home: [stored] }).home[0]).not.toHaveProperty("eyebrow")
  })

  it("names the slide's button and picture, prints the split's own only on a split", async () => {
    const section = banner.parse(band({ variant: "split", eyebrow: "Özel fırsat", edge: "curved" }))
    expect(linksOf(section)).toEqual([SHOP])
    expect(imagesOf(section)).toEqual([WIDE.url])

    const printed = await hydrateSection(section, linked([]))
    expect(printed).toMatchObject({ variant: "split", eyebrow: "Özel fırsat", edge: "curved" })
    const today = await hydrateSection(banner.parse(band()), linked([]))
    expect(today).not.toHaveProperty("variant")
    expect(today).not.toHaveProperty("edge")
  })

  it("mirrors the contract's edges and the upper line's length", () => {
    const contract = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-banner.ts`)
    expect(BANNER_SPLIT_EDGES).toEqual(contract["BANNER_SPLIT_EDGES"])
    expect(BANNER_EYEBROW_MAX).toEqual(contract["BANNER_EYEBROW_MAX"])
    expect(BANNER_SPLIT_BUTTON_TONES).toEqual(contract["BANNER_SPLIT_BUTTON_TONES"])
    expect(BANNER_SPLIT_ORNAMENTS).toEqual(contract["BANNER_SPLIT_ORNAMENTS"])
  })

  it("prints the split's accent button and flower only off their defaults", async () => {
    const plain = await hydrateSection(banner.parse(band({ variant: "split" })), linked([]))
    expect(plain).not.toHaveProperty("button_tone")
    expect(plain).not.toHaveProperty("ornament")
    const set = banner.parse(band({ variant: "split", button_tone: "accent", ornament: "flower" }))
    expect(await hydrateSection(set, linked([]))).toMatchObject({
      button_tone: "accent",
      ornament: "flower",
    })
    expect(() => banner.parse(band({ variant: "split", button_tone: "pink" }))).toThrow()
  })
})
