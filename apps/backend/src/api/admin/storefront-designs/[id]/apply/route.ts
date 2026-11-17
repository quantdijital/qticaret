import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { applyDesignWorkflow } from "../../../../../workflows/storefront/design-apply"
import { adminLayout } from "../../../storefront-layout/read"
import type { AdminPostStorefrontDesignApplyType } from "../../validators"
import { designIdOf } from "../../validators"

/**
 * POST /admin/storefront-designs/:id/apply (adr/0064 §4): the saved look
 * into the theme editor's draft, the draft kept first (`auto_saved`); the
 * shop's menus left alone; nothing goes live. The answer carries the
 * editor's view of the new draft.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStorefrontDesignApplyType>,
  res: MedusaResponse
): Promise<void> {
  const id = designIdOf(req.params)
  const { result } = await applyDesignWorkflow(req.scope).run({
    input: { id, actor: req.auth_context.actor_id, save_as: req.validatedBody.save_as ?? null },
  })
  res.json({ result, layout: await adminLayout(req.scope) })
}
