import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { publishLayoutWorkflow } from "../../../../workflows/storefront/layout-publish"
import { adminLayout } from "../read"
import type { AdminPostStorefrontLayoutPublishType } from "../validators"

/**
 * POST /admin/storefront-layout/publish (adr/0049): the draft goes live as
 * the next revision, with the content pages in draft it names in
 * `pages_live` (adr/0073 Ek 2026-11-19 (2) K5).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStorefrontLayoutPublishType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await publishLayoutWorkflow(req.scope).run({
    input: { actor: req.auth_context.actor_id, pages_live: req.validatedBody.pages_live },
  })
  // Content pages deleted since the save went live without their layouts (adr/0073 §1)
  res.json({ layout: await adminLayout(req.scope), dropped_pages: result.dropped_pages })
}
