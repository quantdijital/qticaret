import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readCollections } from "./read"
import type { AdminGetCollectionBoardType } from "./validators"

/**
 * GET /admin/collection-board (Ürünler > Koleksiyonlar): the panel's list
 * of collections, each with its product count, picture and visibility,
 * which Medusa's `/admin/collections` does not carry. Saves go through
 * Medusa's collection routes and `/admin/collections/:id/details`.
 */
export async function GET(
  req: MedusaRequest<unknown, AdminGetCollectionBoardType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readCollections(req.scope, req.validatedQuery))
}
