import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { registerMediaWorkflow } from "../../../workflows/media/workflows"
import { presentMedia, readMediaList } from "./read"
import type { AdminGetMediaType, AdminPostMediaType } from "./validators"

/** `GET /admin/media`: the media library, newest first (docs/06 Ortam kütüphanesi). */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetMediaType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readMediaList(req.scope, req.validatedQuery))
}

/**
 * `POST /admin/media`: files just uploaded through `/admin/uploads` (checked
 * by their bytes and cleaned there) become images with a name, a size and
 * an alt text (F3.3); `library: true` keeps them in the library.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostMediaType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await registerMediaWorkflow(req.scope).run({
    input: {
      file_ids: req.validatedBody.file_ids,
      library: req.validatedBody.library ?? false,
      uploaded_by: req.auth_context.actor_type === "user" ? req.auth_context.actor_id : null,
    },
  })
  res.json({ media: result.map(presentMedia) })
}
