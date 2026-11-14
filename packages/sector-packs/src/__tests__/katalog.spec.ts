import { sectorPack, storefrontPreset } from "../index"

describe("the katalog preset (adr/0049 Ek 2026-11-14, Katalog ana sayfası; adr/0063)", () => {
  it("reads katalog in the cutlery pack: Grafit's theme, the catalogue home page, no menus or demo", () => {
    const katalog = storefrontPreset("cutlery", "katalog")
    expect(katalog).toMatchObject({
      pack: "cutlery",
      code: "katalog",
      version: 1,
      theme: "atolye",
      name: "Katalog",
      tone: "light",
      menus: null,
      demo: null,
      images: [],
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
    // The shop's header and footer stay as they are
    expect([katalog?.layout.header, katalog?.layout.footer]).toEqual([[], []])
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
      "category:sef-bicaklari",
    ])
  })

  it("raised the cutlery pack's version with its first preset", () => {
    expect(sectorPack("cutlery")?.version).toBe(2)
    expect(sectorPack("cutlery")?.presets.map((preset) => preset.code)).toEqual(["katalog"])
  })
})
