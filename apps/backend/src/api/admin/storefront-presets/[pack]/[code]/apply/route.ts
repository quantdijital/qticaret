import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { applyPresetWorkflow } from "../../../../../../workflows/storefront/preset-apply"
import { adminLayout } from "../../../../storefront-layout/read"
import type { AdminPostStorefrontPresetApplyType } from "../../../validators"
import { presetPath } from "../../../validators"

/**
 * POST /admin/storefront-presets/:pack/:code/apply (adr/0063 §7): the
 * preset written into the theme editor's draft; nothing goes live. What
 * this shop has no record for is named in `skipped` (and the sections
 * left out in `dropped`); the answer carries the editor's view of the new draft.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStorefrontPresetApplyType>,
  res: MedusaResponse
): Promise<void> {
  const path = presetPath.safeParse(req.params)
  if (!path.success) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_preset.unknown")
  }
  const { pack, code } = path.data
  const { result } = await applyPresetWorkflow(req.scope).run({
    input: {
      pack,
      code,
      demo: req.validatedBody.demo,
      actor: req.auth_context.actor_id,
      save_as: req.validatedBody.save_as ?? null,
    },
  })
  res.json({ result, layout: await adminLayout(req.scope) })
}
