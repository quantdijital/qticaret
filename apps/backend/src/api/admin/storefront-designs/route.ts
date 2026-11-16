import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveDesignWorkflow } from "../../../workflows/storefront/design-save"
import { AUDIT_RESOURCE_ID } from "../../http/audit/notes"
import { designGallery } from "./read"
import type { AdminPostStorefrontDesignType } from "./validators"

/** GET /admin/storefront-designs (adr/0064): the saved looks and where the design stands. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await designGallery(req.scope))
}

/**
 * POST /admin/storefront-designs (adr/0064 §4): the draft, or a kept
 * publication (`revision`), saved under a name; the design is read here,
 * never sent. Ten at most, one per name.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStorefrontDesignType>,
  res: MedusaResponse
): Promise<void> {
  const { name, revision } = req.validatedBody
  const { result } = await saveDesignWorkflow(req.scope).run({
    input: { name, revision: revision ?? null, actor: req.auth_context.actor_id },
  })
  res.locals[AUDIT_RESOURCE_ID] = result.id
  const gallery = await designGallery(req.scope)
  res.json({ design: gallery.designs.find((each) => each.id === result.id) ?? null })
}
