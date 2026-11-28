import { sectorPack, storefrontPreset } from "../index"

const katalogVersion = () => storefrontPreset("cutlery", "katalog")?.version

describe("the katalog preset (adr/0049 Ek 2026-11-14, Katalog ana sayfası; adr/0063)", () => {
  it("reads katalog in the cutlery pack: Grafit's theme, the catalogue home page, no menus or demo", () => {
    const katalog = storefrontPreset("cutlery", "katalog")
    expect(katalog).toMatchObject({
      pack: "cutlery",
      code: "katalog",
      version: 6,
      theme: "atolye",
      name: "Katalog",
      tone: "light",
      menus: null,
      demo: null,
      images: [{ path: "images/acilis-bileme.webp", bytes: expect.any(Number) as unknown }],
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

  it("draws the simpler catalog header with its own settings (since its third version)", () => {
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
    expect(katalogVersion()).toBeGreaterThanOrEqual(3)
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
      "page:hakkimizda",
      "page:iletisim",
      "page:kargo-ve-teslimat",
      "page:odeme-secenekleri",
      "page:sik-sorulan-sorular",
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

  it("lays out the shop's Hakkımızda page as one list, its text first (adr/0073 Ek 2026-11-19 (2) K9)", () => {
    const katalog = storefrontPreset("cutlery", "katalog")
    const [about, ...others] = katalog?.layout.pages ?? []
    // Then the starter pages every look lays out (adr/0073 Ek 2026-11-28)
    expect(others.map((page) => page.page_id.$handle)).toEqual([
      "page:iletisim",
      "page:sik-sorulan-sorular",
      "page:odeme-secenekleri",
      "page:kargo-ve-teslimat",
    ])
    expect(about).toMatchObject({ page_id: { $handle: "page:hakkimizda" }, name: "Hakkımızda" })
    // One list, no `placement`: the look's own page text first, then the six sections as before
    expect(about?.sections.map((each) => [each.id, each.type, each["variant"]])).toEqual([
      ["hakkimizdametin", "rich_text", "article"],
      ["hakkimizdahikaye", "rich_text", "with_image"],
      ["hakkimizdainanc", "rich_text", undefined],
      ["hakkimizdavaat", "trust_badges", "lined"],
      ["hakkimizdaraf", "products", undefined],
      ["hakkimizdayorum", "reviews", undefined],
      ["hakkimizdayardim", "help", undefined],
    ])
    expect(about?.sections.some((each) => "placement" in each)).toBe(false)
    const [text, ...design] = about?.sections ?? []
    // Untitled, read as today's page text; the shop's name by its token
    expect(text).toMatchObject({ title: null, outline: "auto", questions: "auto" })
    expect(JSON.stringify(text)).toContain("Köklerimizden geleceğe.")
    expect(JSON.stringify(text)).toContain("{mağaza_adı}, el işçiliğini")
    expect(design[0]).toMatchObject({
      title: "Ateşten doğan karakter",
      image: { $image: "images/acilis-bileme.webp" },
      image_side: "end",
    })
    // The shop's name by its token, never written into the look
    expect(JSON.stringify(design[0])).toContain("{mağaza_adı} olarak")
    expect(design[3]).toMatchObject({
      title: "Atölyeden seçtiklerimiz",
      source: { kind: "best_sellers", days: 90 },
      columns: 4,
      limit: 8,
    })
    expect(design[4]).toMatchObject({ title: "Müşterilerimiz ne diyor", limit: 6 })
    expect(design[5]).toMatchObject({ title: "Hangi bıçak size uygun?" })
    // Shop-facing words only (adr/0073 §4)
    expect(JSON.stringify(about).toLocaleLowerCase("tr")).not.toMatch(/demo|örnek|deneme/)
    // The picture is the bıçak pack's own, credited
    expect(katalog?.credits.map((credit) => credit.file)).toEqual(["images/acilis-bileme.webp"])
    expect(katalog?.description).toContain("Hakkımızda sayfası düzeni")
    // Raised again with the starter pages (adr/0073 Ek 2026-11-28)
    expect(katalogVersion()).toBe(6)
    expect(sectorPack("cutlery")?.version).toBe(17)
  })
})
