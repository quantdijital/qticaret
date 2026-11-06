import { describe, expect, it } from "vitest"
import { categoryIndexJsonLd } from "../category-index"

const PAGE = { name: "Kategoriler", path: "/kategoriler" }
const TREE = [
  {
    label: "Çakılar",
    path: "/kategori/cakilar",
    children: [{ label: "Katlanır", path: "/kategori/cakilar/katlanir", children: [] }],
  },
  { label: "Av bıçağı", path: "/kategori/av", children: [] },
]

describe("categoryIndexJsonLd", () => {
  it("names the page a CollectionPage listing every category it shows, in its order", () => {
    const [block] = categoryIndexJsonLd("magaza.example", PAGE, TREE)
    expect(block).toMatchObject({
      "@type": "CollectionPage",
      name: "Kategoriler",
      url: "https://magaza.example/kategoriler",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: 3,
        itemListElement: [
          { position: 1, name: "Çakılar", url: "https://magaza.example/kategori/cakilar" },
          {
            position: 2,
            name: "Katlanır",
            url: "https://magaza.example/kategori/cakilar/katlanir",
          },
          { position: 3, name: "Av bıçağı", url: "https://magaza.example/kategori/av" },
        ],
      },
    })
  })

  it("says nothing without a canonical host or a category", () => {
    expect(categoryIndexJsonLd(null, PAGE, TREE)).toEqual([])
    expect(categoryIndexJsonLd("magaza.example", PAGE, [])).toEqual([])
  })
})
