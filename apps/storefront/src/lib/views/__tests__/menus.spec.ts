import type { StoreMenu, StoreMenuLink } from "@qticaret/types"
import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { footerMenus, mainMenu, menuLink, topLinks } from "../menus"

const link = (more: Partial<StoreMenuLink>): StoreMenuLink => ({
  label: null,
  kind: "url",
  target: null,
  path: null,
  children: [],
  ...more,
})

const menu = (location: StoreMenu["location"], items: StoreMenuLink[], more = {}): StoreMenu => ({
  title: "Menü",
  location,
  rank: 0,
  items,
  ...more,
})

describe("menu links", () => {
  it("places a record by its path, a storefront page and a legal text by the storefront's own", () => {
    expect(menuLink(link({ kind: "category", label: "Çakılar", path: "/cakilar" }), t)).toEqual({
      label: "Çakılar",
      path: "/cakilar",
    })
    expect(menuLink(link({ kind: "system", target: "cart" }), t)).toEqual({
      label: "Sepetim",
      path: "/sepet",
    })
    expect(
      menuLink(link({ kind: "legal", target: "return_policy", label: "İade politikası" }), t)
    ).toEqual({ label: "İade politikası", path: "/yasal/iade-politikasi" })
  })

  it("links the category index, the brand index and the sale page by name (docs/20)", () => {
    expect(
      ["categories", "brands", "sale"].map((target) =>
        menuLink(link({ kind: "system", target }), t)
      )
    ).toEqual([
      { label: "Kategoriler", path: "/kategoriler" },
      { label: "Markalar", path: "/markalar" },
      { label: "Kampanyalar", path: "/kampanyalar" },
    ])
  })

  it("drops a link without a name or an address", () => {
    expect(menuLink(link({ kind: "system", target: "nowhere" }), t)).toBeNull()
    expect(menuLink(link({ kind: "legal", target: "unknown", label: "X" }), t)).toBeNull()
    expect(menuLink(link({ kind: "category", label: null, path: "/a" }), t)).toBeNull()
  })

  it("prints only a path of its own or a secure address, whatever the backend sent", () => {
    const at = (path: string) => menuLink(link({ label: "Bağlantı", path }), t)?.path ?? null
    expect(at("/magaza")).toBe("/magaza")
    expect(at("https://ornek.example/sayfa")).toBe("https://ornek.example/sayfa")
    for (const bad of [
      "//kotu.example",
      "/\\kotu.example",
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,x",
      "http://ornek.example",
      "https://",
      "https:///kotu",
      "magaza",
      "/ma gaza",
    ]) {
      expect(at(bad)).toBeNull()
    }
  })

  it("builds the header's panels, the top links and the footer's columns in order", () => {
    const menus = [
      menu("footer", [link({ label: "Blog", kind: "system", target: "blog" })], {
        title: "İkinci",
        rank: 1,
      }),
      menu("main", [
        link({
          label: "Çakılar",
          kind: "category",
          path: "/cakilar",
          children: [link({ kind: "system", target: "shop" })],
        }),
      ]),
      menu("top", [link({ label: "Hakkımızda", kind: "page", path: "/hakkimizda" })]),
      menu("footer", [link({ label: "X", path: "https://x.com/ornek" })], { title: "Birinci" }),
      menu("footer", [link({ kind: "legal", target: "unknown" })], { title: "Boş", rank: 2 }),
    ]

    expect(mainMenu(menus, t)).toEqual([
      { label: "Çakılar", path: "/cakilar", children: [{ label: "Tüm ürünler", path: "/magaza" }] },
    ])
    expect(topLinks(menus, t)).toEqual([{ label: "Hakkımızda", path: "/hakkimizda" }])
    expect(footerMenus(menus, t).map((group) => group.title)).toEqual(["Birinci", "İkinci"])
    // No header menu: the category tree shows
    expect(mainMenu([], t)).toBeNull()
  })
})
