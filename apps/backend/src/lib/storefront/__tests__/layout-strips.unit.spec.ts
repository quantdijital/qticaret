import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { imagesOf, linksOf, recordsOf } from "../../../workflows/storefront/layout-check"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { liveRecords } from "../../../workflows/storefront/layout-live"
import { layoutDocument } from "../layout"
import type { BodySection } from "../layout"
import {
  STRIP_GALLERY_DEFAULTS,
  STRIP_GALLERY_LIMITS,
  STRIP_GALLERY_SETTINGS,
  STRIP_SOURCE_KINDS,
  stripGallery,
} from "../sections/strip-gallery"

// The links' resolver as the live filter asks it: a draft product and a gone brand are not live
jest.mock("../../../workflows/storefront/menu-links", () => {
  const actual = jest.requireActual<Record<string, unknown>>(
    "../../../workflows/storefront/menu-links"
  )
  const gone = new Set(["product:prod_taslak", "brand:brand_yok"])
  return {
    ...actual,
    resolveLinks: jest.fn((_container: unknown, links: { id: string }[]) =>
      Promise.resolve(new Map(links.map((link) => [link.id, { broken: gone.has(link.id) }])))
    ),
  }
})

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-strips.ts"
)

const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const PHOTO = { url: "http://localhost:9000/static/serit.webp", alt: "Şerit" }
const custom = { source: { kind: "custom" }, image: PHOTO }
const product = (target: string) => ({ source: { kind: "product", target } })
const gallery = (items: unknown[] = [custom, product("prod_1")], more = {}) => ({
  id: "serit0001",
  type: "strip_gallery",
  items,
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const section = (items?: unknown[], more = {}) => stripGallery.parse(gallery(items, more))

describe("the strip gallery's design (adr/0049 Ek 2026-11-16)", () => {
  it("takes a new section with every step its default, on the home page only", () => {
    const doc = layoutDocument.parse({ home: [gallery()] })

    expect(doc.home[0]).toEqual({
      ...gallery(),
      ...ALWAYS,
      ...STRIP_GALLERY_DEFAULTS,
      title: null,
      text: null,
      items: [
        { ...custom, title: null, note: null, link: null },
        { ...product("prod_1"), image: null, title: null, note: null, link: null },
      ],
    })
    expect(layoutDocument.safeParse({ product: [gallery()] }).success).toBe(false)
    expect(layoutDocument.safeParse({ category: [gallery()] }).success).toBe(false)
  })

  it("holds two to eight strips", () => {
    expect(layoutDocument.safeParse({ home: [gallery([custom])] }).success).toBe(false)
    expect(layoutDocument.safeParse({ home: [gallery(Array(9).fill(custom))] }).success).toBe(false)
    expect(layoutDocument.safeParse({ home: [gallery(Array(8).fill(custom))] }).success).toBe(true)
  })

  it("asks a custom strip for its picture; a record's strip may take the record's", () => {
    expect(issues({ home: [gallery([{ source: { kind: "custom" } }, custom])] })).toEqual([
      "storefront_layout.image_invalid",
    ])
    for (const kind of ["product", "category", "collection", "brand"]) {
      const doc = { home: [gallery([{ source: { kind, target: "rec_1" } }, custom])] }
      expect(layoutDocument.safeParse(doc).success).toBe(true)
    }
  })

  it("refuses a step, a source kind or a record id off its list with the section's key", () => {
    expect(issues({ home: [gallery(undefined, { strips_slant: "vertical" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [gallery(undefined, { width: 3 })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(
      issues({ home: [gallery([custom, { source: { kind: "post", target: "p_1" } }])] })
    ).not.toEqual([])
    expect(issues({ home: [gallery([custom, product("")])] })).toEqual([
      "storefront_layout.target_invalid",
    ])
    // A custom strip names no record
    expect(
      layoutDocument.safeParse({
        home: [gallery([{ ...custom, source: { kind: "custom", target: "prod_1" } }, custom])],
      }).success
    ).toBe(false)
  })

  it("refuses a script or another site's address as a strip's link", () => {
    for (const url of ["javascript:alert(1)", "//evil.example/x"]) {
      const item = { ...custom, link: { kind: "url", url, label: "Bak" } }
      expect(layoutDocument.safeParse({ home: [gallery([item, custom])] }).success).toBe(false)
    }
    const item = { ...custom, link: { kind: "url", url: "/kampanya", label: "Bak" } }
    expect(layoutDocument.safeParse({ home: [gallery([item, custom])] }).success).toBe(true)
  })

  it("takes the shop's details as tokens, refuses an unknown one", () => {
    const named = { ...custom, title: "{mağaza_adı} seçkisi" }
    expect(layoutDocument.safeParse({ home: [gallery([named, custom])] }).success).toBe(true)
    expect(issues({ home: [gallery([{ ...custom, note: "{yok}" }, custom])] })).toEqual([
      "storefront_layout.token_unknown",
    ])
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(STRIP_GALLERY_SETTINGS).toEqual(contract["STRIP_GALLERY_SETTINGS"])
    expect(STRIP_GALLERY_DEFAULTS).toEqual(contract["STRIP_GALLERY_DEFAULTS"])
    expect(STRIP_GALLERY_LIMITS).toEqual(contract["STRIP_GALLERY_LIMITS"])
    expect(STRIP_SOURCE_KINDS).toEqual(contract["STRIP_SOURCE_KINDS"])
  })
})

describe("the strip gallery's checks", () => {
  const shop = { kind: "system", target: "shop", label: null } as const
  const strips = section([
    { ...custom, link: shop },
    product("prod_1"),
    { source: { kind: "brand", target: "brand_1" }, image: PHOTO },
  ])

  it("names its links, its sources and the shop's pictures", () => {
    expect(linksOf(strips)).toEqual([shop])
    expect(recordsOf(strips)).toEqual([
      { kind: "product", target: "prod_1" },
      { kind: "brand", target: "brand_1" },
    ])
    expect(imagesOf(strips)).toEqual([PHOTO.url, PHOTO.url])
  })
})

describe("the strip gallery on the storefront", () => {
  const container = {} as MedusaContainer
  const values = {
    mağaza_adı: "Atölye",
    telefon: null,
    e_posta: null,
    adres: null,
    whatsapp: null,
    ücretsiz_kargo_eşiği: null,
    hazırlama_süresi: "1–2 iş günü",
    kargo_süresi: "1–3 iş günü",
    iade_süresi: "14",
  }
  const context = (more: Partial<HydrateContext> = {}) =>
    ({ values, images: new Map(), links: new Map(), ...more }) as unknown as HydrateContext

  it("keeps a gallery whole for the hydrate to place, one of no live source out", async () => {
    const kept = section([product("prod_taslak"), custom, product("prod_1")])
    const gone = section([
      product("prod_taslak"),
      { source: { kind: "brand", target: "brand_yok" } },
    ])
    const filter = await liveRecords(container, [kept, gone])

    expect(filter([kept, gone] as BodySection[])).toEqual([kept])
    expect(filter.live("product", "prod_1")).toBe(true)
    expect(filter.live("product", "prod_taslak")).toBe(false)
    // A design naming no record asks nothing, and takes every record as live
    const none = await liveRecords(container, [])
    expect(none.live("product", "prod_taslak")).toBe(true)
  })

  it("leaves a source that is not live out, the others at their saved place", async () => {
    const strips = section(
      [
        product("prod_taslak"),
        { ...custom, title: "{mağaza_adı} seçkisi", note: "Yeni" },
        product("prod_1"),
      ],
      { title: "Seçkiler", text: "{mağaza_adı} önerir", strips_dim: "off", width: "boxed" }
    )
    const filter = await liveRecords(container, [strips])
    const shown = await hydrateSection(strips, context({ live: filter.live }))

    expect(shown).toEqual({
      id: "serit0001",
      type: "strip_gallery",
      title: "Seçkiler",
      text: "Atölye önerir",
      items: [
        {
          at: 1,
          source: { kind: "custom" },
          image: { ...PHOTO, width: null, height: null, derivatives: null },
          title: "Atölye seçkisi",
          note: "Yeni",
          link: null,
        },
        {
          at: 2,
          source: { kind: "product", target: "prod_1" },
          image: null,
          title: null,
          note: null,
          link: null,
        },
      ],
      ...STRIP_GALLERY_DEFAULTS,
      strips_dim: "off",
      width: "boxed",
    })
    // The draft product's id never leaves the backend
    expect(JSON.stringify(shown)).not.toContain("prod_taslak")
  })

  it("prints every strip when it is not told what is live (a test's design)", async () => {
    const shown = await hydrateSection(section([product("prod_taslak"), custom]), context())
    expect((shown["items"] as { at: number }[]).map((each) => each.at)).toEqual([0, 1])
  })
})
