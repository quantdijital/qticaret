import { presetMarkers, resolvePreset } from "../resolve"
import type { PresetLookups } from "../resolve"

const SCHEDULE = { visible: true, starts_at: null, ends_at: null }

const lookups: PresetLookups = {
  records: new Map([
    ["category:cakilar", "pcat_cakilar"],
    ["category:bicaklar", "pcat_bicaklar"],
    ["product:av-bicagi", "prod_av"],
    ["brand:demir", "brand_demir"],
  ]),
  links: new Map([
    ["/magaza", { kind: "system" as const, target: "shop" as const }],
    ["/cakilar", { kind: "category" as const, target: "pcat_cakilar" }],
    ["https://ornek.com/rehber", { kind: "url" as const, url: "https://ornek.com/rehber" }],
    // A path on the shop nothing answers
    ["/yok-boyle-bir-yer", null],
  ]),
  images: new Map([["images/hero.webp", "http://localhost:9000/static/hero.webp"]]),
}

const hero = {
  id: "girisbolumu",
  type: "hero",
  ...SCHEDULE,
  heading: null,
  links: [
    { $href: "/cakilar", label: "Çakılar" },
    { $href: "/yok-boyle-bir-yer", label: "Kayıp" },
  ],
  image: { $image: "images/hero.webp", alt: "Atölye" },
}

describe("a preset's references resolved for a shop (adr/0063 §4)", () => {
  it("turns handles into ids, addresses into links and images into library addresses", () => {
    const resolved = resolvePreset(
      {
        home: [
          hero,
          {
            id: "kategoriler",
            type: "categories",
            ...SCHEDULE,
            category_ids: [{ $handle: "category:cakilar" }, { $handle: "category:bicaklar" }],
          },
          {
            id: "yeniurunler",
            type: "products",
            ...SCHEDULE,
            source: { kind: "newest" },
            more: { $href: "/magaza", label: null },
          },
        ],
      },
      null,
      lookups
    )
    expect(resolved.groups.home).toEqual([
      {
        ...hero,
        // The missing button is taken out; the section stays
        links: [{ kind: "category", target: "pcat_cakilar", label: "Çakılar" }],
        image: { url: "http://localhost:9000/static/hero.webp", alt: "Atölye" },
      },
      expect.objectContaining({ category_ids: ["pcat_cakilar", "pcat_bicaklar"] }),
      // A storefront page with no wording: the theme's own ("Tümünü gör"), kept null
      expect.objectContaining({ more: { kind: "system", target: "shop", label: null } }),
    ])
    expect(resolved.skipped).toEqual([{ where: "home.girisbolumu", ref: "/yok-boyle-bir-yer" }])
    expect(resolved.dropped).toEqual([])
    expect(resolved.images).toEqual(["images/hero.webp"])
    expect(resolved.menus).toBeNull()
  })

  it("leaves out what the shop has no record for, never standing in for it", () => {
    const resolved = resolvePreset(
      {
        home: [
          {
            id: "kategoriler",
            type: "categories",
            ...SCHEDULE,
            category_ids: [{ $handle: "category:cakilar" }, { $handle: "category:kiliclar" }],
          },
          // Every chosen brand gone: the section, not "every brand"
          { id: "markalar", type: "brands", ...SCHEDULE, brand_ids: [{ $handle: "brand:yok" }] },
          // Written empty by the preset: "the top categories", kept
          { id: "ustkategori", type: "categories", ...SCHEDULE, category_ids: [] },
          // A section's one record gone: the section goes, with its image
          {
            id: "onecikan",
            type: "featured_product",
            ...SCHEDULE,
            product_id: { $handle: "product:yok" },
          },
          {
            id: "kategorirafi",
            type: "products",
            ...SCHEDULE,
            source: { kind: "category", category_id: { $handle: "category:yok" } },
          },
          {
            id: "elle",
            type: "products",
            ...SCHEDULE,
            source: { kind: "manual", product_ids: [{ $handle: "product:yok" }] },
          },
          // A single button gone: only cleared
          {
            id: "yeniler",
            type: "products",
            ...SCHEDULE,
            source: { kind: "newest" },
            more: { $href: "/yok-boyle-bir-yer", label: "Tümü" },
          },
        ],
        footer: [{ id: "ebultenkutusu", type: "newsletter", ...SCHEDULE }],
      },
      null,
      lookups
    )
    expect(resolved.groups.home.map((section) => (section as { id: string }).id)).toEqual([
      "kategoriler",
      "ustkategori",
      "yeniler",
    ])
    expect(resolved.groups.home[0]).toEqual(
      expect.objectContaining({ category_ids: ["pcat_cakilar"] })
    )
    expect(resolved.groups.home[2]).toEqual(expect.objectContaining({ more: null }))
    expect(resolved.groups.footer).toHaveLength(1)
    expect(resolved.dropped).toEqual([
      "home.markalar",
      "home.onecikan",
      "home.kategorirafi",
      "home.elle",
    ])
    expect(resolved.skipped).toEqual([
      { where: "home.kategoriler", ref: "category:kiliclar" },
      { where: "home.markalar", ref: "brand:yok" },
      { where: "home.onecikan", ref: "product:yok" },
      { where: "home.kategorirafi", ref: "category:yok" },
      { where: "home.elle", ref: "product:yok" },
      { where: "home.yeniler", ref: "/yok-boyle-bir-yer" },
    ])
  })

  it("asks no image of a section left out", () => {
    const resolved = resolvePreset(
      {
        home: [
          {
            id: "pankart",
            type: "banner",
            ...SCHEDULE,
            slides: [{ image: { $image: "images/hero.webp" }, link: null }],
            category_ids: [{ $handle: "category:yok" }],
          },
        ],
      },
      null,
      lookups
    )
    expect(resolved.dropped).toEqual(["home.pankart"])
    expect(resolved.images).toEqual([])
  })

  it("resolves menus, leaving out links nothing answers with their children", () => {
    const resolved = resolvePreset(
      {},
      [
        {
          title: "Ana menü",
          location: "main",
          items: [
            {
              label: "Çakılar",
              href: "/cakilar",
              children: [
                { label: "Rehber", href: "https://ornek.com/rehber" },
                { label: "Kayıp", href: "/yok-boyle-bir-yer" },
              ],
            },
            { label: "Kayıp", href: "/yok-boyle-bir-yer", children: [] },
          ],
        },
        { title: "Kurumsal", location: "footer", items: [{ label: "Mağaza", href: "/magaza" }] },
      ],
      lookups
    )
    expect(resolved.menus).toEqual([
      {
        title: "Ana menü",
        location: "main",
        rank: 0,
        items: [
          {
            link: { kind: "category", target: "pcat_cakilar", label: "Çakılar" },
            children: [{ kind: "url", url: "https://ornek.com/rehber", label: "Rehber" }],
          },
        ],
      },
      {
        title: "Kurumsal",
        location: "footer",
        rank: 1,
        items: [{ link: { kind: "system", target: "shop", label: "Mağaza" }, children: [] }],
      },
    ])
    expect(resolved.skipped).toEqual([
      { where: "menus.main", ref: "/yok-boyle-bir-yer" },
      { where: "menus.main", ref: "/yok-boyle-bir-yer" },
    ])
  })

  it("finds every reference a preset writes, menus' addresses included", () => {
    const found = presetMarkers({
      layout: { home: [hero, { id: "x", category_ids: [{ $handle: "category:cakilar" }] }] },
      menus: [{ items: [{ label: "Mağaza", href: "/magaza", children: [] }] }],
    })
    expect([...found.handles]).toEqual(["category:cakilar"])
    expect([...found.hrefs].sort()).toEqual(["/cakilar", "/magaza", "/yok-boyle-bir-yer"])
    expect([...found.images]).toEqual(["images/hero.webp"])
  })
})
