import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { liraToKurus } from "../../../../validation/lira"
import { updateShopShippingOptionWorkflow } from "../../../../../workflows/shipping/shipping-options"
import type { AdminPostShippingOptionUpdateType } from "../validators"

/** POST /admin/shipping-setup/options/:id: a new name, or a flat option's new amount. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostShippingOptionUpdateType>,
  res: MedusaResponse
): Promise<void> {
  const { name, amount } = req.validatedBody
  await updateShopShippingOptionWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      name,
      ...(amount === undefined ? {} : { amount: liraToKurus(amount) }),
    },
  })
  res.json({ id: req.params["id"] })
}

/** DELETE /admin/shipping-setup/options/:id: shoppers no longer see it; past orders keep theirs. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await deleteShippingOptionsWorkflow(req.scope).run({ input: { ids: [req.params["id"] ?? ""] } })
  res.json({ id: req.params["id"], deleted: true })
}
