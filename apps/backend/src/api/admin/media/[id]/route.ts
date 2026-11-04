import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteMediaWorkflow } from "../../../../workflows/media/library"
import { saveMediaWorkflow } from "../../../../workflows/media/workflows"
import { readMediaDetail } from "../read"
import type { AdminUpdateMediaType } from "../validators"

/** `GET /admin/media/:id`: an image, who uploaded it and where the shop shows it. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ media: await readMediaDetail(req.scope, req.params["id"] ?? "") })
}

/** `POST /admin/media/:id`: an image's alt text (docs/13 §8) and the name the library shows. */
export async function POST(
  req: MedusaRequest<AdminUpdateMediaType>,
  res: MedusaResponse
): Promise<void> {
  const { alt, filename } = req.validatedBody
  const { result } = await saveMediaWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      ...(alt === undefined ? {} : { alt }),
      ...(filename === undefined ? {} : { filename }),
    },
  })
  res.json({ media: { id: result.id, alt: result.alt, filename: result.filename } })
}

/**
 * `DELETE /admin/media/:id`: an image no one shows leaves the library with
 * its files; one in use is refused (409 `media.in_use`).
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await deleteMediaWorkflow(req.scope).run({ input: { id } })
  res.json({ id, object: "media", deleted: true })
}
