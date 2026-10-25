import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEO_REDIRECTS_MODULE } from "../../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../../modules/seo-redirects/service"
import {
  deleteRedirectsWorkflow,
  upsertRedirectWorkflow,
} from "../../../../../workflows/seo/redirects/workflows"
import { presentRedirect } from "../read"
import type { AdminPostRedirectType } from "../validators"

/** The whole rule again, checked as a new one would be. */
export async function POST(
  req: MedusaRequest<AdminPostRedirectType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await upsertRedirectWorkflow(req.scope).run({ input: { id, rule: req.validatedBody } })
  const service = req.scope.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  res.json({ redirect: presentRedirect(await service.retrieveSeoRedirect(id)) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await deleteRedirectsWorkflow(req.scope).run({ input: [id] })
  res.json({ id, object: "seo_redirect", deleted: true })
}
