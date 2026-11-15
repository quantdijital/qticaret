import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"

const CHUNK = 500

/**
 * Hand-entered prices of variants no longer in the shop (a product
 * deleted): their rows went with the variant's price set, the marks are
 * taken away too. Returns how many.
 */
export async function removeOrphanMarks(container: MedusaContainer): Promise<number> {
  const service = container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)
  const marks = await service.listWholesaleManualPrices(
    {},
    { select: ["id", "variant_id"], take: null }
  )
  const ids = [...new Set(marks.map((mark) => mark.variant_id))]
  const existing = new Set<string>()
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (let start = 0; start < ids.length; start += CHUNK) {
    const { data } = await query.graph({
      entity: "product_variant",
      fields: ["id"],
      filters: { id: ids.slice(start, start + CHUNK) },
    })
    for (const row of data as { id: string }[]) {
      existing.add(row.id)
    }
  }
  const orphans = marks.filter((mark) => !existing.has(mark.variant_id)).map((mark) => mark.id)
  if (orphans.length > 0) {
    await service.softDeleteWholesaleManualPrices(orphans)
  }
  return orphans.length
}
