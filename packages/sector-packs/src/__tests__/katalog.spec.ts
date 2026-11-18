import { sectorPack, storefrontPreset } from "../index"

const katalogVersion = () => storefrontPreset("cutlery", "katalog")?.version

describe("the katalog preset (adr/0049 Ek 2026-11-14, Katalog ana sayfası; adr/0063)", () => {
  it("reads katalog in the cutlery pack: Grafit's theme, the catalogue home page, no menus or demo", () => {
    const katalog = storefrontPreset("cutlery", "katalog")
    expect(katalog).toMatchObject({
      pack: "cutlery",
      code: "katalog",
      version: 3,
      theme: "atolye",
      name: "Katalog",
      tone: "light",
      menus: null,
      demo: null,
      images: [],
      preview: "preview.webp",
    })
    // The owner's rule: Grafit's own grounds and signal, no accent of its own
    expect(katalog?.theme_settings).toMatchObject({
      colors: { primary: null, accent: null, background: "steel" },
    })
    expect(katalog?.layout.home?.map((each) => [each.id, each.type])).toEqual([
      ["katalogacilis", "hero"],
      ["coksatanlar", "products"],
      ["yenigelenler", "products"],
      ["kilicrafi", "products"],
      ["fiyatbantlari", "price_bands"],
      ["mutfakrafi", "products"],
      ["celiksap", "categories"],
      ["musteriyorumlari", "reviews"],
    ])
    expect(katalog?.layout.home?.[0]).toMatchObject({ variant: "category_list" })
    // The shop's footer stays as it is
    expect(katalog?.layout.footer).toEqual([])
  })

  it("draws the simpler catalog header with its own settings, on its third version", () => {
    const katalog = storefrontPreset("cutlery", "katalog")
    // One row (the tools named after the phone, a narrow search), no strip, the top links on the bar
    expect(katalog?.layout.header).toEqual([
      expect.objectContaining({
        id: "mainheader",
        type: "header_bar",
        variant: "catalog",
        utility_bar: false,
        tools_place: "row",
        top_links: "bar",
        search_width: "narrow",
        menu_ground: "stage",
        highlight_link: null,
      }),
    ])
    // The menu items' plain look is the style kit's (adr/0067 S1), not the header's
    expect(katalog?.theme_settings).toMatchObject({ menu_style: "plain" })
    expect(katalog?.theme_settings).not.toHaveProperty("shadow")
    expect(katalogVersion()).toBe(3)
  })

  it("asks for the lively motion, the only look that does (adr/0067 Ek 2026-11-18, S7)", () => {
    expect(storefrontPreset("cutlery", "katalog")?.theme_settings).toMatchObject({
      motion: "lively",
    })
    // Every other look keeps today's calm motion by leaving the field out
    const others = (sectorPack("cutlery")?.presets ?? []).filter((each) => each.code !== "katalog")
    expect(others.length).toBeGreaterThan(0)
    expect(others.filter((each) => Object.hasOwn(each.theme_settings, "motion"))).toEqual([])
  })

  it("names the shop's categories by handle, never by id", () => {
    const katalog = storefrontPreset("cutlery", "katalog")
    expect([...(katalog?.handles ?? [])].sort()).toEqual([
      "category:damascus-celik-bicaklar",
      "category:elmax-cakilar",
      "category:epoksi-cakilar",
      "category:geyik-boynuzu-sapli-cakilar",
      "category:kamp-baltalari",
      "category:kemik-sapli-cakilar",
      "category:kilic-modelleri",
      "category:mutfak-sef-serisi",
      "category:n690-cakilar",
      "category:ozel-koleksiyon",
      "category:sef-bicaklari",
    ])
  })

  it("points the collectors' band at the shop's special collection (since its second version)", () => {
    const strip = storefrontPreset("cutlery", "katalog")?.layout.home?.find(
      (each) => each.type === "price_bands"
    ) as { bands: { label: string; max: number | null; category_id?: unknown }[] } | undefined
    expect(strip?.bands.at(-1)).toEqual({
      label: "Koleksiyonluk",
      text: "Özel çelik ve koleksiyon bıçakları",
      max: null,
      category_id: { $handle: "category:ozel-koleksiyon" },
    })
    // The price bands before it keep splitting the shop by price
    expect(strip?.bands.slice(0, -1).map((band) => band.category_id)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(katalogVersion()).toBeGreaterThanOrEqual(2)
    expect(sectorPack("cutlery")?.presets.map((preset) => preset.code)).toContain("katalog")
  })
})
