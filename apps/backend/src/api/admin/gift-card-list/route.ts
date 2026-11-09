import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readGiftCardList } from "./read"
import type { AdminGetGiftCardListType } from "./validators"

/**
 * GET /admin/gift-card-list (adr/0025): the shop's cards a page at a time,
 * by a code or its start and by state; the panel shows codes masked.
 * Behind the gift cards flag, for people.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetGiftCardListType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readGiftCardList(req.scope, req.validatedQuery))
}
