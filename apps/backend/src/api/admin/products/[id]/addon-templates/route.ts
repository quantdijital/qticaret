import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setProductAddonTemplatesWorkflow } from "../../../../../workflows/addon-templates"
import type { AdminPostProductAddonTemplatesType } from "../../../addon-templates/validators"
import { readProductCatalog } from "../catalog/read"

/**
 * The add-on templates linked to the product (adr/0052 Ek 2026-11-23),
 * the whole list; answers with the product's catalog fields, its
 * templates included, as the catalog save does.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostProductAddonTemplatesType>,
  res: MedusaResponse
): Promise<void> {
  const productId = req.params["id"] ?? ""
  await setProductAddonTemplatesWorkflow(req.scope).run({
    input: { product_id: productId, template_ids: req.validatedBody.template_ids },
  })
  res.json(await readProductCatalog(req.scope, productId))
}
