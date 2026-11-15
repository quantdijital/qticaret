import { sectorPack, storefrontPreset } from "../index"

const katalogVersion = () => storefrontPreset("cutlery", "katalog")?.version

describe("the katalog preset (adr/0049 Ek 2026-11-14, Katalog ana sayfası; adr/0063)", () => {
  it("reads katalog in the cutlery pack: Grafit's theme, the catalogue home page, no menus or demo", () => {
    const katalog = storefrontPreset("cutlery", "katalog")
    expect(katalog).toMatchObject({
      pack: "cutlery",
      code: "katalog",
      version: 2,
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
      "category:ozel-koleksiyon",
      "category:sef-bicaklari",
    ])
  })

  it("points the collectors' band at the shop's special collection, on its second version", () => {
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
    expect(katalogVersion()).toBe(2)
    expect(sectorPack("cutlery")?.presets.map((preset) => preset.code)).toContain("katalog")
  })
})
