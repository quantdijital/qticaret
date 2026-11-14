import path from "node:path"
import { imagesOf, linksOf } from "../../../workflows/storefront/layout-check"
import {
  hydrateHero,
  hydratePriceBands,
} from "../../../workflows/storefront/layout-hydrate-catalog"
import { layoutDocument, readStoredLayout } from "../layout"
import { HERO_CATALOG_LIMITS } from "../sections/hero"
import { PRICE_BANDS_LIMITS, bandRanges, bandsRise } from "../sections/price-bands"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-catalog.ts"
)

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const IMAGE = { url: "http://localhost:9000/static/kamp.webp", alt: null }
const hero = (more: Record<string, unknown> = {}) => ({ id: "giris00001", type: "hero", ...more })
const bands = (list: unknown[], more: Record<string, unknown> = {}) => ({
  id: "fiyatbant1",
  type: "price_bands",
  bands: list,
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the opening's category list (H17, adr/0049 Ek 2026-11-14 §3.2)", () => {
  it("reads an opening saved before variants as today's, its own fields untouched", () => {
    const doc = layoutDocument.parse({ home: [hero({ heading: "Yeni sezon" })] })

    expect(doc.home[0]).toEqual({
      ...hero(),
      ...ALWAYS,
      variant: "standard",
      eyebrow: null,
      heading: "Yeni sezon",
      text: null,
      links: [],
      image: null,
    })
  })

  it("fills the category list's own fields with their defaults", () => {
    const doc = layoutDocument.parse({ home: [hero({ variant: "category_list" })] })

    expect(doc.home[0]).toMatchObject({
      variant: "category_list",
      list: { kind: "top" },
      list_limit: HERO_CATALOG_LIMITS.list.default,
      show_count: true,
      tiles: [],
      chips: [],
      picks: [],
      show_price: true,
    })
  })

  it("refuses the list's fields on today's opening, and lists past their limits", () => {
    const tile = { category_id: "pcat_1", image: null }
    const chip = { kind: "system", target: "shop", label: null }
    const pick = { product_id: "prod_1", label: "Yeşil" }
    const list = (more: Record<string, unknown>) => ({
      home: [hero({ variant: "category_list", ...more })],
    })

    expect(issues({ home: [hero({ variant: "standard", tiles: [] })] })).toHaveLength(1)
    expect(issues(list({ tiles: [tile, tile, tile] }))).toHaveLength(1)
    expect(issues(list({ chips: [chip, chip, chip, chip, chip] }))).toHaveLength(1)
    expect(issues(list({ picks: Array.from({ length: 5 }, () => pick) }))).toHaveLength(1)
    expect(issues(list({ list_limit: 3 }))).toHaveLength(1)
    expect(issues(list({ list: { kind: "manual", category_ids: [] } }))).toHaveLength(1)
    expect(issues(list({ picks: [{ ...pick, label: "a".repeat(25) }] }))).toHaveLength(1)
    expect(issues(list({ list: { kind: "menu" }, tiles: [tile], chips: [chip] }))).toEqual([])
  })

  it("reads a stored category list off the list as today's opening, keeping the common fields", () => {
    const doc = readStoredLayout({
      home: [hero({ ...ALWAYS, variant: "bento", heading: "Yeni", tiles: [], list_limit: 6 })],
    })

    expect(doc.home[0]).toMatchObject({ variant: "standard", heading: "Yeni" })
    expect(doc.home[0]).not.toHaveProperty("tiles")
  })

  it("checks its tiles' pictures and quick links with the opening's", () => {
    const [section] = layoutDocument.parse({
      home: [
        hero({
          variant: "category_list",
          image: IMAGE,
          links: [{ kind: "system", target: "shop", label: null }],
          tiles: [{ category_id: "pcat_1", image: { ...IMAGE, url: `${IMAGE.url}?2` } }],
          chips: [{ kind: "category", target: "pcat_2", label: "Kılıçlar" }],
        }),
      ],
    }).home
    if (section?.type !== "hero") {
      throw new Error("no hero")
    }

    expect(imagesOf(section)).toEqual([IMAGE.url, `${IMAGE.url}?2`])
    expect(linksOf(section).map((link) => link.kind)).toEqual(["system", "category"])
  })

  it("prints today's opening as before variants, the list's with its own fields", () => {
    const readers = {
      fill: (text: string | null) => text,
      link: () => ({ label: "Tümü", kind: "system" as const, target: "shop", path: null }),
      image: (url: string, alt: string | null) => ({
        url,
        alt,
        width: 800,
        height: 600,
        derivatives: null,
      }),
    }
    const [plain, listed] = layoutDocument.parse({
      home: [
        hero({ heading: "Yeni" }),
        hero({
          id: "giris00002",
          variant: "category_list",
          tiles: [{ category_id: "pcat_1", image: IMAGE }],
          chips: [{ kind: "system", target: "shop", label: null }],
        }),
      ],
    }).home
    if (plain?.type !== "hero" || listed?.type !== "hero") {
      throw new Error("no hero")
    }

    expect(hydrateHero(plain, readers)).not.toHaveProperty("variant")
    expect(hydrateHero(listed, readers)).toMatchObject({
      variant: "category_list",
      list: { kind: "top" },
      tiles: [{ category_id: "pcat_1", image: { url: IMAGE.url, width: 800, alt: null } }],
      chips: [{ label: "Tümü" }],
    })
  })
})

describe("the price bands (adr/0049 Ek 2026-11-14, Katalog ana sayfası)", () => {
  const band = (label: string, max: number | null) => ({ label, max })

  it("takes two to four rising bands, an open one only last", () => {
    expect(
      issues({
        home: [
          bands([band("₺500 altı", 500), band("₺1.000 altı", 1000), band("Koleksiyonluk", null)]),
        ],
      })
    ).toEqual([])
    expect(issues({ home: [bands([band("Tek", 500)])] })).toHaveLength(1)
    expect(issues({ home: [bands([band("Pahalı", 1000), band("Ucuz", 500)])] })).toEqual([
      "storefront_layout.price_bands_order",
    ])
    expect(issues({ home: [bands([band("Açık", null), band("Ucuz", 500)])] })).toEqual([
      "storefront_layout.price_bands_order",
    ])
    expect(issues({ home: [bands([band("Kesirli", 499.9), band("Açık", null)])] })).toHaveLength(1)
    expect(issues({ product: [bands([band("A", 1), band("B", 2)])] })).toHaveLength(1)
  })

  it("takes two strips on the home page, a third refused, hidden ones counted", () => {
    const strip = (id: string, more: Record<string, unknown> = {}) => ({
      ...bands([band("A", 500), band("B", null)]),
      id,
      ...more,
    })

    expect(issues({ home: [strip("fiyatbant1"), strip("fiyatbant2")] })).toEqual([])
    expect(
      issues({
        home: [strip("fiyatbant1"), strip("fiyatbant2"), strip("fiyatbant3", { visible: false })],
      })
    ).toEqual(["storefront_layout.price_bands_limit"])
    expect(PRICE_BANDS_LIMITS.perPage).toBe(2)
  })

  it("fills a band's line and the products shown small", () => {
    const [section] = layoutDocument.parse({
      home: [bands([band("₺500 altı", 500), band("Daha fazlası", null)])],
    }).home

    expect(section).toMatchObject({
      thumbs: PRICE_BANDS_LIMITS.thumbs.default,
      bands: [{ text: null }, { text: null }],
    })
  })

  it("prints each band's range and its picked products", () => {
    const [section] = layoutDocument.parse({
      home: [bands([band("₺500 altı", 500), band("₺1.000 altı", 1000), band("Üstü", null)])],
    }).home
    if (section?.type !== "price_bands") {
      throw new Error("no bands")
    }

    expect(hydratePriceBands(section, [["prod_1"], [], ["prod_2"]], (text) => text)).toEqual({
      id: "fiyatbant1",
      type: "price_bands",
      title: null,
      bands: [
        { label: "₺500 altı", text: null, min: null, max: 500, product_ids: ["prod_1"] },
        { label: "₺1.000 altı", text: null, min: 501, max: 1000, product_ids: [] },
        { label: "Üstü", text: null, min: 1001, max: null, product_ids: ["prod_2"] },
      ],
    })
    expect(hydratePriceBands(section, undefined, (text) => text).bands[0]?.product_ids).toEqual([])
  })

  it("mirrors the contract's limits and rules", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    const rises = contract["bandsRise"] as typeof bandsRise
    const ranges = contract["bandRanges"] as typeof bandRanges
    const cases = [[{ max: 1 }, { max: null }], [{ max: 2 }, { max: 1 }], [{ max: null }]]

    expect(PRICE_BANDS_LIMITS).toEqual(contract["PRICE_BANDS_LIMITS"])
    expect(HERO_CATALOG_LIMITS).toEqual(contract["HERO_CATALOG_LIMITS"])
    expect(cases.map(bandsRise)).toEqual(cases.map(rises))
    expect(cases.map(bandRanges)).toEqual(cases.map(ranges))
  })
})

describe("the category cards' counts and link", () => {
  it("leaves both off for a section from before them", () => {
    const [section] = layoutDocument.parse({
      home: [{ id: "kategori01", type: "categories" }],
    }).home

    expect(section).toMatchObject({ show_count: false, more: null })
  })
})
