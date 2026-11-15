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

describe("the tezgah presets (adr/0063; docs/tema/tezgah-tasarim-dili.md)", () => {
  it("reads tezgah in the cutlery pack: no menus, no demo, no images of its own", () => {
    expect(read("tezgah")).toMatchObject({
      pack: "cutlery",
      code: "tezgah",
      version: 2,
      theme: "atolye",
      name: "Tezgâh",
      tone: "light",
      credits: [],
      menus: null,
      demo: null,
      images: [],
      preview: null,
    })
  })

  it("lays the home page out as the design language's order", () => {
    const home = read("tezgah").layout.home ?? []
    expect(home.map((each) => [each.id, each.type, each["variant"] ?? null])).toEqual([
      ["tezgahacilis", "hero", "category_list"],
      ["guvenseridi", "trust_badges", "lined"],
      ["yenirafi", "products", "carousel"],
      ["avrafi", "products", "carousel"],
      ["kamprafi", "products", "carousel"],
      ["sefrafi", "products", "carousel"],
      ["yakinplan", "featured_product", null],
      ["fiyatbantlari", "price_bands", null],
      ["coksatanlar", "products", "featured"],
      ["kullanimagore", "categories", "linked"],
      ["indirimdekiler", "products", "compact"],
      ["yazilar", "posts", null],
      ["markalar", "brands", null],
      ["kisalisteler", "products", "columns"],
      ["musteriyorumlari", "reviews", null],
    ])
    // Two well bands, never side by side; nothing else takes a ground of its own
    const grounds = home.map((each) => (each["look"] as { ground?: unknown } | undefined)?.ground)
    expect(home.filter((_, index) => grounds[index] === "well").map((each) => each.id)).toEqual([
      "kullanimagore",
      "markalar",
    ])
    // Nothing turns by itself: every rail's scroller still, with square arrows by the heading
    for (const rail of home.filter((each) => each["variant"] === "carousel")) {
      expect(rail["scroller"]).toMatchObject({
        autoplay: "off",
        arrows: "always",
        arrow_style: "square",
        arrow_position: "head",
        loop: "off",
      })
    }
  })

  it("never stands two separate rails side by side, so the theme does not join them as tabs", () => {
    const home = read("tezgah").layout.home ?? []
    const at = (id: string) => home.findIndex((each) => each.id === id)
    // A section every shop draws (static price bands, the pack's categories) stands between
    expect(home[at("coksatanlar") - 1]?.type).toBe("price_bands")
    expect(home[at("indirimdekiler") - 1]?.type).toBe("categories")
    expect(home[at("fiyatbantlari")]).toMatchObject({ thumbs: 0 })
  })

  it("draws the category cards with their subcategories, only top categories that have some", () => {
    const cards = (read("tezgah").layout.home ?? []).find((each) => each.id === "kullanimagore")
    expect(cards).toMatchObject({
      type: "categories",
      variant: "linked",
      columns: 3,
      image_position: "side",
      frame: "lined",
      links: 5,
      show_count: true,
    })
    const categories = sectorPack("cutlery")?.categories ?? []
    const named = (cards?.["category_ids"] as { $handle: string }[]).map((each) =>
      each.$handle.replace(/^category:/, "")
    )
    expect(named).toEqual(["outdoor-ve-kamp", "mutfak-ve-sef-bicaklari", "kasap-bicaklari"])
    for (const handle of named) {
      expect(categories.find((each) => each.handle === handle)?.parent).toBeUndefined()
      expect(categories.some((each) => each.parent === handle)).toBe(true)
    }
  })

  it("draws the catalog header on a graphite bar and fills the footer", () => {
    const { header, footer, product, category } = read("tezgah").layout
    expect(header).toEqual([
      expect.objectContaining({
        id: "mainheader",
        type: "header_bar",
        ...ALWAYS,
        variant: "catalog",
        menu_ground: "stage",
        utility_bar: true,
        phone: true,
        categories_button: true,
        highlight_link: { $href: "/kampanyalar", label: "İndirimdekiler" },
      }),
    ])
    expect(footer?.map((each) => each.type)).toEqual(["footer_bar", "newsletter"])
    // Glyphs for the profiles, written payment names, a square back-to-top button on the right
    expect(footer?.[0]).toMatchObject({
      variant: "ledger",
      social: "icons",
      payment_badges: ["visa", "mastercard", "troy", "bank_transfer", "cash_on_delivery"],
      back_to_top: true,
      back_to_top_side: "right",
      back_to_top_shape: "square",
      back_to_top_mobile: true,
    })
    expect([product, category]).toEqual([[], []])
  })

  it("keeps its words plain: no arrows, no capitalised line above a heading", () => {
    const text = JSON.stringify(read("tezgah").layout)
    expect(text).not.toMatch(/→|->/)
    for (const section of read("tezgah").layout.home ?? []) {
      expect(section["eyebrow"] ?? null).toBeNull()
    }
  })

  it("names the pack's categories and one product by handle, never by id", () => {
    expect(read("tezgah").handles).toEqual([
      "category:av-bicaklari",
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

  it("gives the siblings the same layout and card, only their colours apart", () => {
    const main = read("tezgah")
    const { colors: mainColors, ...mainRest } = main.theme_settings
    for (const sibling of CODES.slice(1).map(read)) {
      expect(sibling.layout).toEqual(main.layout)
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
  })

  it("raised the cutlery pack's version with them", () => {
    expect(sectorPack("cutlery")?.version).toBe(4)
    expect(sectorPack("cutlery")?.presets.map((preset) => preset.code)).toEqual([
      "katalog",
      ...CODES,
    ])
  })
})
