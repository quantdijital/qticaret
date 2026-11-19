import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { publishLayoutWorkflow } from "../../../../workflows/storefront/layout"
import { adminLayout } from "../read"

/** POST /admin/storefront-layout/publish (adr/0049): the draft goes live as the next revision. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await publishLayoutWorkflow(req.scope).run({
    input: req.auth_context.actor_id,
  })
  // Content pages deleted since the save went live without their layouts (adr/0073 §1)
  res.json({ layout: await adminLayout(req.scope), dropped_pages: result.dropped_pages })
}
