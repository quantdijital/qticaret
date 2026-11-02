import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { publishLayoutWorkflow } from "../../../../workflows/storefront/layout"
import { adminLayout } from "../read"

/** POST /admin/storefront-layout/publish (adr/0049): the draft goes live as the next revision. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await publishLayoutWorkflow(req.scope).run({ input: req.auth_context.actor_id })
  res.json({ layout: await adminLayout(req.scope) })
}
