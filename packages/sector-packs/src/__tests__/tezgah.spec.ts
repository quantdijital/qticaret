import { sectorPack, storefrontPreset } from "../index"

/** The Tezgâh preset and its two colour siblings (docs/tema/tezgah-tasarim-dili.md; adr/0063). */
const CODES = ["tezgah", "tezgah-lacivert", "tezgah-turuncu"] as const

const read = (code: string) => {
  const preset = storefrontPreset("cutlery", code)
  if (!preset) {
    throw new Error(`no ${code} preset`)
  }
  return preset
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const home = () => read("tezgah").layout.home ?? []
const section = (id: string) => home().find((each) => each.id === id)

/** A licence that lets the picture ship in a public repository and every shop. */
const OPEN_LICENCE = /^(?:CC BY(?:-SA)? [234]\.0|CC0 1\.0|Public domain),/

describe("the tezgah presets (adr/0063; docs/tema/tezgah-tasarim-dili.md)", () => {
  it("reads tezgah in the cutlery pack: its menus and its own credited pictures, no demo", () => {
    const tezgah = read("tezgah")
    expect(tezgah).toMatchObject({
      pack: "cutlery",
      code: "tezgah",
      version: 11,
      theme: "atolye",
      name: "Tezgâh",
      tone: "light",
      demo: null,
      preview: "preview.webp",
    })
    expect(tezgah.description.length).toBeLessThanOrEqual(400)
    expect(tezgah.images.map((image) => image.path)).toEqual(
      tezgah.credits.map((credit) => credit.file).sort()
    )
    for (const credit of tezgah.credits) {
      expect(credit.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
      expect(credit.license).toMatch(OPEN_LICENCE)
    }
  })

  it("keeps every picture small: webp, at most 150 KB each", () => {
    for (const code of CODES) {
      for (const image of read(code).images) {
        expect(image.path).toMatch(/\.webp$/)
        expect(image.bytes).toBeLessThanOrEqual(150_000)
      }
    }
  })

  it("lays a full home page out, each section's kind once (the tabbed rail aside)", () => {
    expect(home().map((each) => [each.id, each.type, each["variant"] ?? null])).toEqual([
      ["tezgahacilis", "hero", "category_list"],
      ["guvenseridi", "trust_badges", "lined"],
      ["yenirafi", "products", "stage_list"],
      ["kullanimagore", "categories", "panels"],
      ["yakinplan", "featured_product", null],
      ["avrafi", "products", "carousel"],
      ["kamprafi", "products", "carousel"],
      ["sefrafi", "products", "carousel"],
      ["fiyatbantlari", "price_bands", null],
      ["indirimdekiler", "products", "ranked"],
      ["seritgaleri", "strip_gallery", null],
      ["kisalisteler", "products", "columns"],
      ["setbandi", "banner", null],
      ["coksatanlar", "products", "strips"],
      ["markalar", "brands", null],
      ["kategoriseridi", "marquee", null],
      ["musteriyorumlari", "reviews", null],
      ["sikcasorulanlar", "faq", null],
    ])
    // Two well bands, never side by side
    const grounds = home().map((each) => (each["look"] as { ground?: unknown } | undefined)?.ground)
    expect(
      home()
        .filter((_, index) => grounds[index] === "well")
        .map((each) => each.id)
    ).toEqual(["markalar"])
  })

  it("joins only the three category rails as tabs: no other product sections side by side", () => {
    const rails = home()
      .map((each, index) => ({ each, before: home()[index - 1] }))
      .filter(({ each, before }) => each.type === "products" && before?.type === "products")
      .map(({ each }) => each.id)
    expect(rails).toEqual(["kamprafi", "sefrafi"])
    for (const id of ["avrafi", "kamprafi", "sefrafi"]) {
      expect(section(id)?.["scroller"]).toMatchObject({
        autoplay: "off",
        arrows: "always",
        arrow_style: "square",
        arrow_position: "head",
      })
    }
  })

  it("opens on four filled slides that turn by themselves, with tiles and quick links", () => {
    const opening = section("tezgahacilis")
    const slides = opening?.["slides"] as {
      heading: string
      text: string
      links: unknown[]
      image: { $image: string; alt: string }
    }[]
    expect(slides).toHaveLength(4)
    for (const slide of slides) {
      expect(slide.heading.length).toBeGreaterThan(0)
      expect(slide.text.length).toBeGreaterThan(0)
      expect(slide.image.$image).toMatch(/^images\/acilis-/)
      expect(slide.image.alt.length).toBeGreaterThan(0)
    }
    expect(opening?.["scroller"]).toMatchObject({ autoplay: "on", loop: "on", dots: "on" })
    expect(opening?.["tiles"]).toHaveLength(2)
    expect(opening?.["chips"]).toHaveLength(4)
    // A compact first screen: the slide's words share a third of the row with the arrows, so
    // each slide keeps one button and a short line, no small products (they made the whole
    // opening ~900 px tall on desktop, the category list's rows spread over it)
    expect(opening?.["picks"]).toEqual([])
    for (const slide of slides) {
      expect(slide.links).toHaveLength(1)
      expect(slide.text.length).toBeLessThanOrEqual(120)
    }
  })

  it("draws top categories as the photo panels with their subcategories", () => {
    const cards = section("kullanimagore")
    expect(cards).toMatchObject({ columns: 3, height: "medium", lead: "on", links: 5 })
    const categories = sectorPack("cutlery")?.categories ?? []
    const named = (cards?.["category_ids"] as { $handle: string }[]).map((each) =>
      each.$handle.replace(/^category:/, "")
    )
    expect(named).toEqual(["outdoor-ve-kamp", "mutfak-ve-sef-bicaklari", "cakilar"])
    // Top categories only; the pack's skeleton gives the first two their children (the demo, all three)
    for (const handle of named) {
      expect(categories.find((each) => each.handle === handle)?.parent).toBeUndefined()
    }
    expect(named.filter((handle) => categories.some((each) => each.parent === handle))).toEqual([
      "outdoor-ve-kamp",
      "mutfak-ve-sef-bicaklari",
    ])
  })

  it("puts the featured product's strips beside it and fills the strip gallery with pictures", () => {
    expect(section("yakinplan")).toMatchObject({ gallery: "strips", strips_layout: "side" })
    const items = section("seritgaleri")?.["items"] as { image: { $image: string } }[]
    expect(section("seritgaleri")).toMatchObject({ title: "Tezgâhtan seçmeler" })
    expect(items).toHaveLength(5)
    expect(items.every((item) => item.image.$image.startsWith("images/serit-"))).toBe(true)
    expect(section("coksatanlar")).toMatchObject({ limit: 8, strips_count: 8 })
  })

  it("draws the simple catalog header: a search icon, pictures in the menu, the free-shipping note", () => {
    const { header, footer } = read("tezgah").layout
    expect(header).toEqual([
      expect.objectContaining({
        id: "mainheader",
        type: "header_bar",
        ...ALWAYS,
        variant: "catalog",
        menu_ground: "stage",
        search_style: "icon",
        tools_place: "row",
        menu_images: "all",
        // Filled from the shop's details when read; not shown without a threshold
        strip_note: "{ücretsiz_kargo_eşiği} üzeri siparişlerde kargo bedava",
        strip_note_link: { $href: "/kampanyalar" },
      }),
    ])
    expect(footer?.map((each) => each.type)).toEqual(["footer_bar", "newsletter"])
    // adr/0070 PR-5: the free rows the panel's seed gives (the reach strip, the brand and three menus)
    const bar = footer?.[0] as {
      rows?: { columns: { blocks: { type: string; about?: string; address?: boolean }[] }[] }[]
    }
    expect(footer?.[0]).toMatchObject({
      variant: "free_rows",
      social: "icons",
      ground: "well",
      badge_style: "card",
      bottom_badges: true,
      payment_badges: ["visa", "mastercard", "troy", "bank_transfer", "cash_on_delivery"],
      back_to_top: true,
      back_to_top_shape: "square",
    })
    const blocks = (bar.rows ?? []).map((row) => row.columns.flatMap((each) => each.blocks))
    expect(blocks.map((row) => row.map((block) => block.type))).toEqual([
      ["contact"],
      ["brand", "menu", "menu", "menu"],
    ])
    // The address where the brand columns drew it: under the brand's line, not in the reach strip
    expect(blocks[0]?.[0]).toMatchObject({ type: "contact", address: false })
    expect(blocks[1]?.[0]).toMatchObject({ type: "brand", address: true })
    const about = blocks[1]?.[0]?.about ?? ""
    expect(about.length).toBeGreaterThan(0)
    expect(about.length).toBeLessThanOrEqual(240)
    // The box is the side-by-side band; `text` stays the consent sentence, so it is the shop's own
    for (const code of CODES) {
      const box = read(code).layout.footer?.[1] as
        { text?: string | null; description?: string; note?: string } | undefined
      // On the footer's ground as its top band, as the brand columns drew it (adr/0070 §4 Ek)
      expect(box).toMatchObject({
        id: "ebultenkutusu",
        variant: "split",
        show_note: true,
        joined: true,
      })
      expect(box?.text).toBeNull()
      expect(box?.description?.length).toBeLessThanOrEqual(240)
      expect(box?.note?.length).toBeLessThanOrEqual(80)
    }
  })

  it("fills the product and category pages with sections every shop draws", () => {
    const { product, category } = read("tezgah").layout
    expect(product?.map((each) => [each.id, each.type])).toEqual([
      ["mainproduct", "product_main"],
      ["urunguvence", "trust_badges"],
      ["benzerurunler", "related_products"],
      ["urunsorulari", "faq"],
    ])
    expect(product?.[2]).toMatchObject({ variant: "carousel", source: { kind: "same_category" } })
    expect(category?.map((each) => [each.id, each.type])).toEqual([
      ["maincategory", "category_main"],
      ["kategoriguvence", "trust_badges"],
    ])
  })

  it("sets the menus: the categories with their children for the picture menu, top links, three footer columns", () => {
    const menus = read("tezgah").menus ?? []
    expect(menus.map((menu) => [menu.location, menu.items.length])).toEqual([
      ["main", 7],
      ["top", 3],
      ["footer", 6],
      ["footer", 4],
      ["footer", 4],
    ])
    const main = menus[0]?.items ?? []
    expect(main.every((item) => item.href.startsWith("/kategori/"))).toBe(true)
    expect(main.filter((item) => (item.children?.length ?? 0) > 0).length).toBeGreaterThan(3)
  })

  it("keeps its words plain and real: no arrows, no trial text, a line above the opening only", () => {
    const text = JSON.stringify([read("tezgah").layout, read("tezgah").menus])
    expect(text).not.toMatch(/→|->|Deneme|Lorem/i)
    expect(
      home()
        .filter((each) => each["eyebrow"])
        .map((each) => each.id)
    ).toEqual(["tezgahacilis"])
  })

  it("names the pack's categories and products by handle, never by id", () => {
    expect(read("tezgah").handles).toEqual([
      "category:av-bicaklari",
      "category:bakim-ve-aksesuar",
      "category:cakilar",
      "category:kamp-bicaklari",
      "category:kasap-bicaklari",
      "category:kiliclar",
      "category:mutfak-bicak-setleri",
      "category:mutfak-ve-sef-bicaklari",
      "category:outdoor-ve-kamp",
      "category:sef-bicaklari",
      "product:karacelik-alageyik-sam-celigi-av-bicagi",
    ])
  })

  it("gives the siblings the same layout, menus, pictures and card, only their colours apart", () => {
    const main = read("tezgah")
    const { colors: mainColors, ...mainRest } = main.theme_settings
    for (const sibling of CODES.slice(1).map(read)) {
      expect(sibling.layout).toEqual(main.layout)
      expect(sibling.menus).toEqual(main.menus)
      expect(sibling.images).toEqual(main.images)
      expect(sibling.credits).toEqual(main.credits)
      const { colors, ...rest } = sibling.theme_settings
      expect(rest).toEqual(mainRest)
      expect(colors).not.toEqual(mainColors)
      expect(sibling.name).toMatch(/^Tezgâh · /)
    }
    expect(CODES.map((code) => read(code).theme_settings["colors"])).toEqual([
      { primary: "#b3261e", accent: "#2e3338", background: "steel" },
      { primary: "#33709c", accent: "#1f4f8f", background: "steel" },
      { primary: "#b03b0b", accent: "#2e3338", background: "steel" },
    ])
    for (const code of CODES) {
      expect(read(code).theme_settings["surface_style"]).toBe("lined")
    }
  })

  it("shows the three as one gallery card, each by its colour (adr/0064 Ek 2026-11-17)", () => {
    expect(CODES.map((code) => [read(code).family, read(code).swatch])).toEqual([
      ["tezgah", "Antrasit ve kırmızı"],
      ["tezgah", "Lacivert ve çelik"],
      ["tezgah", "Antrasit ve turuncu"],
    ])
    expect(read("katalog")).toMatchObject({ family: null, swatch: null })
    // Each colour its own thumbnail (`pnpm preset:previews`)
    expect(CODES.map((code) => read(code).preview)).toEqual([
      "preview.webp",
      "preview.webp",
      "preview.webp",
    ])
  })

  it("raised the cutlery pack's version with them (tezgah's eleventh)", () => {
    expect(sectorPack("cutlery")?.version).toBe(14)
    expect(CODES.map((code) => read(code).version)).toEqual([11, 11, 11])
    expect(sectorPack("cutlery")?.presets.map((preset) => preset.code)).toEqual([
      "katalog",
      ...CODES,
    ])
  })
})
