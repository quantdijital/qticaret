import "server-only"
import type { StoreCategory, StoreImage } from "@qticaret/types"
import type { CategoryTreeView } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storePublicGet } from "@/lib/store-api/server"
import { categoryTree, subtreeIds } from "./categories"
import { mapLimited } from "./limited"
import { categoryGlance, PHOTO_REQUESTS } from "./nav-pictures"

/** The index as it is drawn: every top category and the categories right below it. */
export interface CategoryIndex {
  categories: CategoryTreeView[]
  /** Every product the shop lists; null when the backend did not count them. */
  total: number | null
}

/** How many products the shop lists in all, kept a minute for every visitor; null unanswered. */
async function productTotal(): Promise<number | null> {
  try {
    const { count } = await storePublicGet<{ count?: number }>("/store/products", {
      limit: 1,
      fields: "id",
    })
    return typeof count === "number" && Number.isFinite(count) ? count : null
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/**
 * `/kategoriler` (design.md § Kategoriler sayfası): the tree, every top
 * category and every one right below it a picture tile with its product
 * count. A tile without the shop's own picture gets its
 * newest product's photo from the same request that counts it (one per
 * category, `PHOTO_REQUESTS` at a time, kept a minute for every visitor,
 * shared with the home page's tiles). Deeper categories stay in the tree
 * as they are: their parents' pages show them. A category the backend
 * could not answer for keeps its name only.
 */
export async function categoryIndex(
  categories: readonly StoreCategory[],
  paths: Record<string, string>,
  pictures: ReadonlyMap<string, StoreImage>
): Promise<CategoryIndex> {
  const tree = categoryTree(categories, paths, pictures)
  const idByPath = new Map(Object.entries(paths).map(([id, path]) => [path, id]))
  const glanced = async (node: CategoryTreeView): Promise<CategoryTreeView> => {
    const id = idByPath.get(node.path)
    const glance = id ? await categoryGlance(subtreeIds(categories, id)) : null
    if (!glance) {
      return node
    }
    const image = node.image ?? glance.photo
    return { ...node, ...(image ? { image } : {}), count: glance.count }
  }
  const [counted, total] = await Promise.all([
    mapLimited(
      tree.flatMap((top) => [top, ...top.children]),
      PHOTO_REQUESTS,
      glanced
    ),
    productTotal(),
  ])
  const byPath = new Map(counted.map((node) => [node.path, node]))
  const drawn = (node: CategoryTreeView): CategoryTreeView => byPath.get(node.path) ?? node
  return {
    categories: tree.map((top) => ({ ...drawn(top), children: top.children.map(drawn) })),
    total,
  }
}
