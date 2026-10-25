import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import { upsertRedirectWorkflow } from "../../../../workflows/seo/redirects/workflows"
import { presentRedirect, readRedirects } from "./read"
import type { AdminGetRedirectsType, AdminPostRedirectType } from "./validators"

export async function GET(
  req: MedusaRequest<unknown, AdminGetRedirectsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readRedirects(req.scope, req.validatedQuery))
}

/** A rule written in the panel (adr/0017); stored flat, chains to its source closed. */
export async function POST(
  req: MedusaRequest<AdminPostRedirectType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await upsertRedirectWorkflow(req.scope).run({
    input: { rule: req.validatedBody, origin: "manual" },
  })
  const service = req.scope.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  res.status(201).json({ redirect: presentRedirect(await service.retrieveSeoRedirect(result.id)) })
}
