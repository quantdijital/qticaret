import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setMediaAltWorkflow } from "../../../../workflows/media/workflows"
import type { AdminPostMediaAltType } from "../validators"

/** `POST /admin/media/:id`: an image's alt text (docs/13 §8). */
export async function POST(
  req: MedusaRequest<AdminPostMediaAltType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await setMediaAltWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", alt: req.validatedBody.alt },
  })
  res.json({ media: { id: result.id, alt: result.alt } })
}
