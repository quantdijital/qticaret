import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveLayoutDraftWorkflow } from "../../../workflows/storefront/layout"
import { adminLayout } from "./read"
import type { AdminPostStorefrontLayoutType } from "./validators"

/** GET /admin/storefront-layout (adr/0049): the draft, what changed, the revisions. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ layout: await adminLayout(req.scope) })
}

/** POST /admin/storefront-layout: the draft saved whole; nothing reaches shoppers until published. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStorefrontLayoutType>,
  res: MedusaResponse
): Promise<void> {
  await saveLayoutDraftWorkflow(req.scope).run({ input: req.validatedBody.document })
  res.json({ layout: await adminLayout(req.scope) })
}
