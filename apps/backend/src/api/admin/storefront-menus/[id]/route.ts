import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adminMenus } from "../../../../workflows/storefront/menus-read"
import {
  deleteStorefrontMenuWorkflow,
  saveStorefrontMenuWorkflow,
} from "../../../../workflows/storefront/menus"
import type { AdminPostStorefrontMenuType } from "../validators"

/** POST /admin/storefront-menus/:id (adr/0049): the menu replaced whole, its links in order. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStorefrontMenuType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await saveStorefrontMenuWorkflow(req.scope).run({ input: { ...req.validatedBody, id } })
  const menu = (await adminMenus(req.scope)).find((each) => each.id === id)
  res.json({ menu })
}

/** DELETE /admin/storefront-menus/:id: the menu and its links. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await deleteStorefrontMenuWorkflow(req.scope).run({ input: id })
  res.json({ id, object: "storefront_menu", deleted: true })
}
