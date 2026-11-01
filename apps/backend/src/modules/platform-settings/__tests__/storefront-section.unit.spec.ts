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
      whatsapp_phone: null,
    })
  })

  it("takes the shop's frame: lines, links, columns, promises and a WhatsApp number", () => {
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
      whatsapp_phone: "0532 123 45 67",
    })

    expect(parsed.whatsapp_phone).toBe("+905321234567")
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
    expect(patch.safeParse({ whatsapp_phone: "12" }).success).toBe(false)
  })
})
