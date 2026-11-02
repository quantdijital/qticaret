import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { giftCardBalance } from "../../../../workflows/gift-cards/balance"
import type { StorePostGiftCardBalanceType } from "./validators"

/**
 * POST /store/gift-cards/balance (adr/0025 Ek 2026-11-03): what a card has
 * left, by its code in the body (never in a path a log keeps). An unknown
 * code is 404 `gift_card.unknown`.
 */
export async function POST(
  req: MedusaStoreRequest<StorePostGiftCardBalanceType>,
  res: MedusaResponse
): Promise<void> {
  const balance = await giftCardBalance(req.scope, req.validatedBody.code)
  if (!balance) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "gift_card.unknown")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json(balance)
}
