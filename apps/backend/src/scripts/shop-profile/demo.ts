import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { logger } from "../../lib/logging"
import { DEMO_CATEGORIES } from "../seed/data"

/**
 * Takes the demo seed's categories off the storefront once a shop's own
 * profile is in: they stay (the demo products still use them), inactive,
 * so a later seed finds and keeps them. `demo:remove` takes them out.
 */
export async function hideDemoCategories(container: MedusaContainer): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "is_active"],
    filters: { handle: DEMO_CATEGORIES.map((category) => category.handle) },
  })
  const active = data.filter((category) => category.is_active)
  if (active.length === 0) {
    return
  }
  await updateProductCategoriesWorkflow(container).run({
    input: {
      selector: { id: active.map((category) => category.id) },
      update: { is_active: false },
    },
  })
  logger.info({ event: "shop_profile.demo_hidden", count: active.length }, "demo categories hidden")
}
