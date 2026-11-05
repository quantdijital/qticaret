import { filePathOf, shortCategoryPaths } from "../legacy-addresses"

describe("a WordPress migration's explicit legacy entries (adr/0059)", () => {
  it("gives each subcategory the short path WooCommerce served beside its full one", () => {
    // The base taken off (Rank Math): `/mutfak/tavalar` and `/tavalar` both served
    expect(
      shortCategoryPaths([
        { path: "/mutfak", target_id: "pcat_1" },
        { path: "/mutfak/tavalar", target_id: "pcat_2" },
        { path: "/mutfak/tavalar/dokum", target_id: "pcat_3" },
        { path: "/bahce", target_id: "pcat_4" },
      ])
    ).toEqual([
      { path: "/tavalar", target_id: "pcat_2" },
      { path: "/dokum", target_id: "pcat_3" },
    ])
    // Under a base (`/urun-kategori/`), the short path keeps it
    expect(
      shortCategoryPaths([
        { path: "/urun-kategori/mutfak", target_id: "pcat_1" },
        { path: "/urun-kategori/mutfak/tavalar", target_id: "pcat_2" },
      ])
    ).toEqual([{ path: "/urun-kategori/tavalar", target_id: "pcat_2" }])
  })

  it("never gives a short path another category's", () => {
    expect(
      shortCategoryPaths([
        { path: "/mutfak", target_id: "pcat_1" },
        { path: "/mutfak/mutfak", target_id: "pcat_2" },
      ])
    ).toEqual([])
  })

  it("reads a picture item's file on the old host only", () => {
    const key = (url: string) => `product:10 ${url}`
    expect(
      filePathOf(key("https://www.mylarte.com/wp-content/uploads/2024/05/Tava.PNG"), "mylarte.com")
    ).toBe("/wp-content/uploads/2024/05/tava.png")
    expect(filePathOf(key("http://127.0.0.1:4100/wp-content/uploads/a.png"), "127.0.0.1")).toBe(
      "/wp-content/uploads/a.png"
    )
    // A CDN's copy cannot be redirected from here: another host
    expect(filePathOf(key("https://i0.wp.com/mylarte.com/a.png"), "mylarte.com")).toBeNull()
    expect(filePathOf("product:10 not a url", "mylarte.com")).toBeUndefined()
  })
})
