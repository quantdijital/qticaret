import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { importMediaWorkflow } from "../../../../workflows/media/library"
import { presentMedia } from "../read"
import type { AdminImportMediaType } from "../validators"

/**
 * `POST /admin/media/import`: an image at an outside address is fetched
 * (SSRF rules, 10 MB), checked and cleaned as an upload, and kept in the
 * library, so a page shows the shop's own copy rather than someone else's.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminImportMediaType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await importMediaWorkflow(req.scope).run({
    input: {
      url: req.validatedBody.url,
      uploaded_by: req.auth_context.actor_type === "user" ? req.auth_context.actor_id : null,
    },
  })
  const [asset] = result
  res.status(201).json({ media: asset ? presentMedia(asset) : null })
}
