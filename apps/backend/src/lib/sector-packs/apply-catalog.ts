import { Modules } from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { packItemKey } from "@qticaret/sector-packs"
import { uniqueViolationKeys } from "../errors"
import type { ApplyContext } from "./context"

/**
 * The pack's suggested categories (adr/0061 C12), in the file's order so a
 * parent is there before its children. Made through Medusa's workflow, so
 * the catalog's own hook claims each one's address (docs/13 §2); made
 * **hidden** (`is_active: false`): the storefront shows a category with
 * its image, and the shop decides which it sells. A handle already here is
 * the shop's category, kept; a child whose parent is gone is skipped.
 */
export async function applyCategories(context: ApplyContext): Promise<void> {
  const products = context.container.resolve(Modules.PRODUCT)
  const idOf = async (handle: string): Promise<string | null> => {
    const [found] = await products.listProductCategories({ handle }, { select: ["id"], take: 1 })
    return found?.id ?? null
  }
  for (const category of context.pack.categories) {
    const key = packItemKey.category(category.handle)
    if (context.offered.has(key)) {
      continue
    }
    const existing = await idOf(category.handle)
    if (existing) {
      await context.record({ key, kind: "category", outcome: "kept", record_id: existing })
      continue
    }
    const parentId = category.parent ? await idOf(category.parent) : null
    if (category.parent && !parentId) {
      await context.record({ key, kind: "category", outcome: "skipped", record_id: null })
      continue
    }
    let made: string | null = null
    try {
      const { result } = await createProductCategoriesWorkflow(context.container).run({
        input: {
          product_categories: [
            {
              name: category.name,
              handle: category.handle,
              is_active: false,
              ...(parentId ? { parent_category_id: parentId } : {}),
              ...(category.description ? { description: category.description } : {}),
            },
          ],
        },
      })
      made = result[0]?.id ?? null
    } catch (error) {
      // A handle a removed category of the shop's still holds: nothing to add
      if (!uniqueViolationKeys(error)?.includes("handle")) {
        throw error
      }
    }
    await context.record({
      key,
      kind: "category",
      outcome: made ? "added" : "skipped",
      record_id: made,
    })
  }
}
