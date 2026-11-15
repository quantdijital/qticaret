import type { StoreCategory } from "@qticaret/types"
import { describe, expect, it } from "vitest"
import type { ImageView, NavCategoryView } from "@qticaret/ui"
import { categoryTree, withPicturesOf } from "../categories"

const category = (id: string, name: string, parent: string | null, rank = 0): StoreCategory => ({
  id,
  name,
  handle: id,
  description: null,
  parent_category_id: parent,
  rank,
})

describe("the category index (/kategoriler)", () => {
  const categories = [
    category("c-mutfak", "Mutfak", null, 1),
    category("c-bicak", "Bıçaklar", null, 0),
    category("c-cakilar", "Çakılar", "c-bicak", 1),
    category("c-sef", "Şef bıçakları", "c-bicak", 0),
    category("c-japon", "Japon şef", "c-sef"),
    category("c-alman", "Alman şef", "c-sef"),
    category("c-gizli", "Gizli", null, 2),
    category("c-alt", "Altında", "c-gizli"),
  ]
  const paths = Object.fromEntries(
    categories.filter((each) => each.id !== "c-gizli").map((each) => [each.id, `/${each.id}`])
  )

  it("nests every live category under its own, in the shop's order, then by Turkish name", () => {
    expect(categoryTree(categories, paths)).toEqual([
      {
        label: "Bıçaklar",
        path: "/c-bicak",
        children: [
          {
            label: "Şef bıçakları",
            path: "/c-sef",
            children: [
              { label: "Alman şef", path: "/c-alman", children: [] },
              { label: "Japon şef", path: "/c-japon", children: [] },
            ],
          },
          { label: "Çakılar", path: "/c-cakilar", children: [] },
        ],
      },
      { label: "Mutfak", path: "/c-mutfak", children: [] },
    ])
  })

  it("leaves out a category with no live path, and what is below it", () => {
    const tree = categoryTree(categories, paths)
    expect(JSON.stringify(tree)).not.toContain("c-gizli")
    expect(JSON.stringify(tree)).not.toContain("c-alt")
    expect(categoryTree(categories, {})).toEqual([])
  })

  it("stops four levels down", () => {
    const deep = ["a", "b", "c", "d", "e"].map((id, index, all) =>
      category(id, id.toUpperCase(), index === 0 ? null : (all[index - 1] ?? null))
    )
    const tree = categoryTree(
      deep,
      Object.fromEntries(deep.map((each) => [each.id, `/${each.id}`]))
    )
    const fourth = tree[0]?.children[0]?.children[0]?.children[0]
    expect(fourth?.label).toBe("D")
    expect(fourth?.children).toEqual([])
  })
})

describe("the catalog header's list pictures (adr/0049 Ek 2026-11-15)", () => {
  const image = (src: string): ImageView => ({
    src,
    alt: "",
    width: null,
    height: null,
    sources: { avif: null, webp: null },
  })

  it("takes the menu's picture for the same page, keeping the shop's own", () => {
    const tree: NavCategoryView[] = [
      {
        label: "Bıçaklar",
        path: "/bicak",
        children: [
          { label: "Şef", path: "/sef" },
          { label: "Çakı", path: "/caki", image: image("own.jpg") },
          { label: "Satır", path: "/satir" },
        ],
      },
      { label: "Mutfak", path: "/mutfak", children: [] },
    ]
    const menu: NavCategoryView[] = [
      {
        label: "Bıçaklar",
        path: "/bicak",
        image: image("top.jpg"),
        children: [
          { label: "Şef", path: "/sef", image: image("sef.jpg") },
          { label: "Çakı", path: "/caki", image: image("newest.jpg") },
        ],
      },
    ]
    const [knives, kitchen] = withPicturesOf(tree, menu)
    expect(knives?.image?.src).toBe("top.jpg")
    expect(knives?.children.map((child) => child.image?.src)).toEqual([
      "sef.jpg",
      "own.jpg",
      undefined,
    ])
    // A page the menu does not hold keeps none
    expect(kitchen).toEqual(tree[1])
  })
})
