import type { StoreCategory } from "@qticaret/types"
import { describe, expect, it } from "vitest"
import { categoryTree } from "../categories"

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
