import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { SEO_REDIRECTS_MODULE } from "../../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../../modules/seo-redirects/service"

/** Takes a path off the 404 log (dealt with, or noise); it comes back if visitors keep asking. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const service = req.scope.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const [row] = await service.listSeoNotFounds({ id }, { take: 1, select: ["id"] })
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.not_found_unknown")
  }
  await service.deleteSeoNotFounds(id)
  res.json({ id, object: "seo_not_found", deleted: true })
}
