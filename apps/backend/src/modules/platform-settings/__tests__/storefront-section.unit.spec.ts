import { storefrontSection } from "../sections/storefront"

const { full, patch, defaults } = storefrontSection

describe("storefront section", () => {
  it("starts empty, and its defaults pass its own checks", () => {
    expect(full.safeParse(defaults).success).toBe(true)
    expect(defaults).toEqual({
      announcements: [],
      top_links: [],
      footer_groups: [],
      trust_badges: [],
      menu: [],
      primary_color: null,
      hero: null,
      contact_form_path: "/iletisim",
      color_swatches: [],
    })
  })

  it("takes colour names with their colours, each name once", () => {
    expect(
      patch.parse({ color_swatches: [{ label: "Lacivert", hex: "#1E3A8A" }] }).color_swatches
    ).toEqual([{ label: "Lacivert", hex: "#1e3a8a" }])
    expect(
      patch.safeParse({
        color_swatches: [
          { label: "Mavi", hex: "#0000ff" },
          { label: "MAVİ", hex: "#0000fe" },
        ],
      }).success
    ).toBe(false)
    expect(patch.safeParse({ color_swatches: [{ label: "Kırmızı", hex: "red" }] }).success).toBe(
      false
    )
  })

  it("takes a shop path for the contact form, or none, and nothing else", () => {
    expect(patch.parse({ contact_form_path: " /Bize-Ulasin " }).contact_form_path).toBe(
      "/bize-ulasin"
    )
    expect(patch.parse({ contact_form_path: null }).contact_form_path).toBeNull()
    for (const bad of ["/", "https://evil.example", "//evil.example", "javascript:alert(1)"]) {
      expect(patch.safeParse({ contact_form_path: bad }).success).toBe(false)
    }
  })

  it("takes the shop's frame: lines, links, columns and promises", () => {
    const parsed = full.parse({
      announcements: ["1500 TL ve üzeri kargo bedava", "16:00'ya kadar aynı gün kargo"],
      top_links: [{ label: "Hakkımızda", href: "/hakkimizda" }],
      footer_groups: [
        {
          title: "Kurumsal",
          links: [
            { label: "Blog", href: "/blog" },
            { label: "Instagram", href: "https://instagram.com/ornek" },
          ],
        },
      ],
      trust_badges: [{ icon: "truck", title: "Ücretsiz kargo", text: "1500 TL ve üzeri" }],
      contact_form_path: "/iletisim",
      color_swatches: [],
      menu: [
        {
          label: "Çakılar",
          href: "/kategori/el-yapimi-caki",
          children: [{ label: "N690 Çakılar", href: "/kategori/el-yapimi-caki/n690-cakilar" }],
        },
        { label: "Tüm Ürünler", href: "/magaza", children: [] },
      ],
      primary_color: " #0B5C99 ",
      hero: {
        eyebrow: "Yatağan el işçiliği",
        heading: "El yapımı çakı ve bıçaklar",
        text: null,
        links: [{ label: "Özel koleksiyon", href: "/kategori/ozel-koleksiyon" }],
      },
    })

    expect(parsed.primary_color).toBe("#0b5c99")
    expect(parsed.menu[0]?.children).toHaveLength(1)
    expect(parsed.footer_groups[0]?.links[1]?.href).toBe("https://instagram.com/ornek")
  })

  it.each([
    ["a script", "javascript:alert(1)"],
    ["another host without a scheme", "//evil.example.com"],
    ["plain http", "http://ornek.com"],
    ["a backslash path", "/\\evil.example.com"],
    ["credentials in the address", "https://user:pass@ornek.com"],
    ["whitespace in a path", "/iade ve degisim"],
  ])("refuses a link to %s", (_, href) => {
    expect(patch.safeParse({ top_links: [{ label: "Bağlantı", href }] }).success).toBe(false)
  })

  it("keeps each list short, refuses empty columns, unknown icons and control characters", () => {
    const line = "Kargo bedava"
    expect(patch.safeParse({ announcements: Array(6).fill(line) }).success).toBe(false)
    expect(patch.safeParse({ footer_groups: [{ title: "Boş", links: [] }] }).success).toBe(false)
    expect(
      patch.safeParse({ trust_badges: [{ icon: "rocket", title: "Hızlı", text: null }] }).success
    ).toBe(false)
    expect(patch.safeParse({ announcements: ["Kargo\u0000bedava"] }).success).toBe(false)
    // The WhatsApp number moved to the store details (adr/0048)
    expect(patch.safeParse({ whatsapp_phone: "+905321234567" }).success).toBe(false)
    expect(patch.safeParse({ primary_color: "blue" }).success).toBe(false)
    const hero = { eyebrow: null, heading: "Başlık", text: null }
    expect(
      patch.safeParse({ hero: { ...hero, links: Array(3).fill({ label: "a", href: "/a" }) } })
        .success
    ).toBe(false)
    expect(patch.safeParse({ hero: { ...hero, heading: "", links: [] } }).success).toBe(false)
    expect(
      patch.safeParse({ menu: [{ label: "Kötü", href: "javascript:void(0)", children: [] }] })
        .success
    ).toBe(false)
  })
})
