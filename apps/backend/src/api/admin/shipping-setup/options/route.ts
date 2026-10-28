import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { liraToKurus } from "../../../validation/lira"
import {
  createShopShippingOptionWorkflow,
  shopShippingOptions,
} from "../../../../workflows/shipping/shipping-options"
import type { AdminPostShippingOptionType } from "./validators"

/** GET /admin/shipping-setup/options (F7.8): the shop's shipping options, as the panel lists them. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ options: await shopShippingOptions(req.scope) })
}

/** POST /admin/shipping-setup/options: a new option in the default warehouse's Türkiye zone. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostShippingOptionType>,
  res: MedusaResponse
): Promise<void> {
  const { name, carrier, pricing } = req.validatedBody
  const { result } = await createShopShippingOptionWorkflow(req.scope).run({
    input: {
      name,
      carrier,
      pricing:
        pricing.type === "flat" ? { type: "flat", amount: liraToKurus(pricing.amount) } : pricing,
    },
  })
  res.json({ id: result })
}
