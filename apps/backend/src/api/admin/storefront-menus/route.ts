import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminMenus } from "../../../workflows/storefront/menus-read"
import { saveStorefrontMenuWorkflow } from "../../../workflows/storefront/menus"
import type { AdminPostStorefrontMenuType } from "./validators"

/**
 * GET /admin/storefront-menus (adr/0049): every menu with its links, each
 * with what it shows now and whether it is broken (its record gone or not
 * live, its legal text not published).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ menus: await adminMenus(req.scope) })
}

/** POST /admin/storefront-menus: a new menu with its links. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStorefrontMenuType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await saveStorefrontMenuWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  const menu = (await adminMenus(req.scope)).find((each) => each.id === result.id)
  res.status(201).json({ menu })
}
