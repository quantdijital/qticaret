import { describe, expect, it } from "vitest"
import type { StorefrontFrame } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { displayPhone, footerGroups, socialLinks, whatsappHref } from "../frame"

const empty: StorefrontFrame = {
  announcements: [],
  top_links: [],
  footer_groups: [],
  trust_badges: [],
  whatsapp_phone: null,
  menu: [],
  primary_color: null,
  hero: null,
  contact_form_path: null,
  color_swatches: [],
}

describe("contact details", () => {
  it("shows a Turkish number as it is read, and links WhatsApp without the plus", () => {
    expect(displayPhone("+905321234567")).toBe("0532 123 45 67")
    expect(displayPhone("+442071234567")).toBe("+442071234567")
    expect(whatsappHref("+905321234567")).toBe("https://wa.me/905321234567")
  })

  it("names the shop's profiles by network, others by host, and skips a broken address", () => {
    expect(
      socialLinks([
        "https://www.instagram.com/ornek",
        "https://youtu.be/abc",
        "https://tr.pinterest.com/ornek",
        "https://www.ornek-blog.com/",
        "not a url",
      ])
    ).toEqual([
      { label: "Instagram", href: "https://www.instagram.com/ornek" },
      { label: "YouTube", href: "https://youtu.be/abc" },
      { label: "Pinterest", href: "https://tr.pinterest.com/ornek" },
      { label: "ornek-blog.com", href: "https://www.ornek-blog.com/" },
    ])
  })
})

describe("footerGroups", () => {
  const categories = Array.from({ length: 10 }, (_, index) => ({
    label: `Kategori ${index + 1}`,
    path: `/kategori-${index + 1}`,
    children: [],
  }))

  it("uses the shop's own columns when it wrote some", () => {
    const groups = footerGroups(
      {
        ...empty,
        footer_groups: [{ title: "Kurumsal", links: [{ label: "Blog", href: "/blog" }] }],
      },
      categories,
      t
    )

    expect(groups).toEqual([{ title: "Kurumsal", links: [{ label: "Blog", path: "/blog" }] }])
  })

  it("else lists the first eight categories and the cart", () => {
    const groups = footerGroups(empty, categories, t)

    expect(groups.map((group) => group.title)).toEqual(["Kategoriler", "Yardım"])
    expect(groups[0]?.links).toHaveLength(8)
    expect(groups[1]?.links).toEqual([{ label: "Sepetim", path: "/sepet" }])
  })

  it("shows only the help column for a shop without categories", () => {
    expect(footerGroups(empty, [], t).map((group) => group.title)).toEqual(["Yardım"])
  })
})
