import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteUnusedMediaWorkflow } from "../../../../workflows/media/delete-unused"
import type { AdminDeleteMediaBatchType } from "../validators"

/**
 * `POST /admin/media/delete` (M1, docs/06 Ortam kütüphanesi): pictures
 * deleted from the library at once. Each is checked on the server against
 * every place that may show it, whatever the panel listed: only those
 * nothing shows go, with their files. Answers which went and which were
 * kept (in use, gone, or their files refused by storage).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminDeleteMediaBatchType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await deleteUnusedMediaWorkflow(req.scope).run({
    input: { ids: req.validatedBody.ids },
  })
  res.json(result)
}
