import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setCollectionDetailsWorkflow } from "../../../../../workflows/catalog/collection-details"
import { readCollection } from "../../../collection-board/read"
import type { AdminPostCollectionDetailsType } from "./validators"

/**
 * POST /admin/collections/:id/details: the collection's text, visibility
 * and picture, which Medusa's collection has no field for. Its title and
 * handle are Medusa's (`POST /admin/collections/:id`).
 */
export async function POST(
  req: MedusaRequest<AdminPostCollectionDetailsType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await setCollectionDetailsWorkflow(req.scope).run({
    input: { collection_id: id, ...req.validatedBody },
  })
  res.json({ collection: await readCollection(req.scope, id) })
}
