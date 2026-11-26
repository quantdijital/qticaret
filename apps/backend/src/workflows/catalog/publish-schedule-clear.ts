import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { hasSchedule, withoutSchedule } from "../../lib/catalog/publish-schedule"
import type { Metadata } from "../../lib/catalog/publish-schedule"

export interface ClearedSchedule {
  id: string
  metadata: Metadata
}

/**
 * A product published another way (by hand, in bulk, by import) drops its
 * planned publish (S2): taken back to draft later, a plan left behind
 * would publish it again at once. Answers with what it changed, to undo.
 */
export async function clearPublishedSchedules(
  container: MedusaContainer,
  ids: readonly string[]
): Promise<ClearedSchedule[]> {
  if (ids.length === 0) {
    return []
  }
  const products = container.resolve(Modules.PRODUCT)
  const live = await products.listProducts(
    { id: [...ids], status: "published" },
    { select: ["id", "metadata"], take: ids.length }
  )
  const cleared: ClearedSchedule[] = []
  for (const product of live) {
    const metadata = (product.metadata ?? {}) as Metadata
    if (!hasSchedule(metadata)) {
      continue
    }
    await products.updateProducts(product.id, { metadata: withoutSchedule(metadata) })
    cleared.push({ id: product.id, metadata })
  }
  return cleared
}

/** Puts the plans back, when the update that cleared them is undone. */
export async function restoreSchedules(
  container: MedusaContainer,
  cleared: readonly ClearedSchedule[]
): Promise<void> {
  const products = container.resolve(Modules.PRODUCT)
  for (const each of cleared) {
    await products.updateProducts(each.id, { metadata: each.metadata })
  }
}
