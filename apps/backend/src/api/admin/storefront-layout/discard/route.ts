import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { draftSource, saveLayoutDraftWorkflow } from "../../../../workflows/storefront/layout"
import { adminLayout } from "../read"

/** POST /admin/storefront-layout/discard (adr/0049): the draft back to what is live (or the default). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const source = await draftSource(req.scope, null)
  await saveLayoutDraftWorkflow(req.scope).run({ input: source })
  res.json({ layout: await adminLayout(req.scope) })
}
