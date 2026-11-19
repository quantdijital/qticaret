import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { replaceDraftWorkflow } from "../../../../workflows/storefront/draft-replace"
import { draftSource } from "../../../../workflows/storefront/layout"
import { adminLayout } from "../read"

/**
 * POST /admin/storefront-layout/discard (adr/0049): the draft back to what
 * is live (or the default), kept first as an automatic save when it held
 * anything new (adr/0064 Ek 2026-11-17); `auto_saved` names it.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const source = await draftSource(req.scope, null)
  const { result } = await replaceDraftWorkflow(req.scope).run({
    input: {
      source: source.document,
      text_at: source.text_at,
      actor: req.auth_context.actor_id,
      reason: "discard",
    },
  })
  res.json({
    layout: await adminLayout(req.scope),
    auto_saved: result.auto_saved,
    dropped_pages: result.dropped_pages,
  })
}
