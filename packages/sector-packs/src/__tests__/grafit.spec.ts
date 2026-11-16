import { sectorPack, storefrontPreset } from "../index"

describe("the presets in this package (adr/0063 §8)", () => {
  it("reads grafit in the general pack: Atölye's look, balanced and compact, no menus, no demo", () => {
    const grafit = storefrontPreset("general", "grafit")
    expect(grafit).toMatchObject({
      pack: "general",
      code: "grafit",
      version: 1,
      theme: "atolye",
      name: "Grafit",
      tone: "light",
      credits: [],
      menus: null,
      demo: null,
      images: [],
      preview: null,
      handles: [],
    })
    expect(grafit?.theme_settings).toEqual({
      settings_version: 2,
      theme: "atolye",
      colors: { primary: null, accent: null, background: "steel" },
      typography: { heading: "manrope", body: "manrope" },
      radius: "gentle",
      product_card: { ratio: "1:1", show_brand: true, show_rating: false },
      header: { layout: "left", sticky: true },
      buttons: "pill",
      section_spacing: "compact",
      density: "balanced",
    })
    const layout = grafit?.layout
    expect(layout?.home?.map((each) => [each.id, each.type])).toEqual([
      ["girisbolumu", "hero"],
      ["kategoriler", "categories"],
      ["yeniurunler", "products"],
      ["yardimkutusu", "help"],
      ["blogyazilari", "posts"],
    ])
    expect(layout?.home?.[2]?.["more"]).toEqual({ $href: "/magaza", label: null })
    expect(layout?.footer?.map((each) => each.type)).toEqual(["newsletter"])
    expect([layout?.header, layout?.product, layout?.category]).toEqual([[], [], []])
  })

  it("raised the general pack's version with its first preset", () => {
    expect(sectorPack("general")?.version).toBe(2)
    expect(storefrontPreset("general", "yok")).toBeNull()
    expect(storefrontPreset("yok", "grafit")).toBeNull()
  })
})
