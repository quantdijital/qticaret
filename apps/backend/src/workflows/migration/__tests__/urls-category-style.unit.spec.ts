import { hintOf, stylePaths } from "../urls-category-style"

const CATEGORIES = [
  { id: "c1", handle: "el-yapimi-caki", mpath: "c1" },
  { id: "c2", handle: "damascus-cakilar", mpath: "c1.c2" },
  { id: "c3", handle: "cakmak-cakilar", mpath: "c1.c3" },
  // A handle from before slugs were checked: no path in any style
  { id: "c4", handle: "Eski Kategori", mpath: "c4" },
]

describe("the category URL style an old site's addresses ask for (adr/0017 Ek 2026-11-23)", () => {
  const paths = stylePaths(CATEGORIES)

  it("makes each style's path for every category whose chain is all slugs", () => {
    expect(paths.get("c2")).toEqual({
      prefixed: "/kategori/el-yapimi-caki/damascus-cakilar",
      nested: "/el-yapimi-caki/damascus-cakilar",
      flat: "/damascus-cakilar",
    })
    expect(paths.has("c4")).toBe(false)
  })

  it("suggests the nested style for a WooCommerce site with its category base taken off", () => {
    const old = [
      { entity_id: "c1", path: "/el-yapimi-caki" },
      { entity_id: "c2", path: "/el-yapimi-caki/damascus-cakilar" },
      { entity_id: "c3", path: "/el-yapimi-caki/cakmak-cakilar" },
    ]

    expect(hintOf("prefixed", old, paths)).toEqual({
      current: "prefixed",
      total: 3,
      kept: { prefixed: 0, nested: 3, flat: 1 },
      suggested: "nested",
    })
  })

  it("suggests nothing when the current style keeps the most, a tie included", () => {
    const old = [{ entity_id: "c1", path: "/el-yapimi-caki" }]

    // Nested and flat both keep a root category's address
    expect(hintOf("flat", old, paths)?.suggested).toBeNull()
    expect(
      hintOf("prefixed", [{ entity_id: "c2", path: "/urun-kategori/damascus-cakilar" }], paths)
        ?.suggested
    ).toBeNull()
  })

  it("has no hint without an old address tied to a category that has a path", () => {
    expect(hintOf("prefixed", [], paths)).toBeNull()
    expect(hintOf("prefixed", [{ entity_id: "c4", path: "/eski-kategori" }], paths)).toBeNull()
  })
})
