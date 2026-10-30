import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ageOn } from "../../../../../lib/catalog"
import { ValidationError } from "../../../../../lib/errors"
import { ageCheck, declareAgeWorkflow } from "../../../../../workflows/legal/age"
import type { StorePostAgeDeclarationType } from "./validators"

/**
 * GET /store/carts/:id/age-declaration (F13.3): whether the checkout asks
 * the buyer's age (a restricted product, the shop checking), the shop's
 * limit, and whether the buyer declared it.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const cartId = req.params["id"] ?? ""
  // Only an open cart of this storefront's: no other learns what a cart holds
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at", "sales_channel_id"],
    filters: { id: cartId },
  })
  const cart = data[0] as { completed_at?: unknown; sales_channel_id?: string | null } | undefined
  if (
    !cart ||
    cart.completed_at ||
    !req.publishable_key_context.sales_channel_ids.includes(cart.sales_channel_id ?? "")
  ) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({ age_check: await ageCheck(req.scope, cartId) })
}

/**
 * POST /store/carts/:id/age-declaration: the buyer declares their age. The
 * date of birth is checked and dropped; under the limit nothing is kept
 * and the cart cannot be paid for.
 */
export async function POST(
  req: MedusaStoreRequest<StorePostAgeDeclarationType>,
  res: MedusaResponse
): Promise<void> {
  // The date of birth stops here: only the age goes on, and nothing keeps it
  const age = ageOn(req.validatedBody.birth_date, new Date())
  if (age === null) {
    throw new ValidationError("age.birth_date_invalid", { field: "birth_date" })
  }
  const { result } = await declareAgeWorkflow(req.scope).run({
    input: {
      cart_id: req.params["id"] ?? "",
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
      age,
    },
  })
  res.json({ age_declaration: result })
}
