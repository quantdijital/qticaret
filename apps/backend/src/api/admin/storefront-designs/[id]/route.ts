import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteDesignWorkflow,
  renameDesignWorkflow,
} from "../../../../workflows/storefront/design-save"
import { designGallery } from "../read"
import { designIdOf } from "../validators"
import type { AdminPostStorefrontDesignUpdateType } from "../validators"

/**
 * POST /admin/storefront-designs/:id (adr/0064): renamed; an automatic save
 * given a name becomes a named look, within the ten.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStorefrontDesignUpdateType>,
  res: MedusaResponse
): Promise<void> {
  const id = designIdOf(req.params)
  await renameDesignWorkflow(req.scope).run({ input: { id, name: req.validatedBody.name } })
  const gallery = await designGallery(req.scope)
  res.json({ design: gallery.designs.find((each) => each.id === id) ?? null })
}

/** DELETE /admin/storefront-designs/:id (adr/0064 K2): removed for good; the panel asks first. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = designIdOf(req.params)
  await deleteDesignWorkflow(req.scope).run({ input: id })
  res.json({ id, object: "storefront_design", deleted: true })
}
