import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { setStockTrackingWorkflow } from "../../../../../workflows/stock/stock-tracking"
import type { AdminPostProductStockTrackingType } from "./validators"

interface VariantRow {
  id: string
  manage_inventory?: boolean | null
  inventory_items?: ({ inventory_item_id: string } | null)[] | null
}

/**
 * Turns the variants' stock tracking on (with the count at the default
 * location) or off (docs/06 "Ürün sayfası"); answers with each variant's
 * flag and item.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostProductStockTrackingType>,
  res: MedusaResponse
): Promise<void> {
  const productId = req.params["id"] ?? ""
  const body = req.validatedBody
  await setStockTrackingWorkflow(req.scope).run({
    input: {
      product_id: productId,
      tracked: body.tracked,
      variants: body.variants,
      actor_id: req.auth_context.actor_id || null,
    },
  })
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "manage_inventory", "inventory_items.inventory_item_id"],
    filters: { id: body.variants.map((each) => each.id), product_id: productId },
  })
  res.json({
    variants: (data as VariantRow[]).map((variant) => ({
      id: variant.id,
      manage_inventory: variant.manage_inventory === true,
      inventory_item_id: variant.inventory_items?.find(Boolean)?.inventory_item_id ?? null,
    })),
  })
}
