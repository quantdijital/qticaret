import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { registerMediaWorkflow } from "../../../workflows/media/workflows"
import type { AdminPostMediaType } from "./validators"

/** `POST /admin/media`: uploaded files become product images with an alt text and versions (F3.3). */
export async function POST(
  req: MedusaRequest<AdminPostMediaType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await registerMediaWorkflow(req.scope).run({
    input: { file_ids: req.validatedBody.file_ids },
  })
  res.json({
    media: result.map(({ id, url, width, height, alt }) => ({ id, url, width, height, alt })),
  })
}
