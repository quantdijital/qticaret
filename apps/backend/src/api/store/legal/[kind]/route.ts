import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { ContentDoc } from "../../../../lib/content"
import { LEGAL_MODULE } from "../../../../modules/legal"
import type LegalModuleService from "../../../../modules/legal/service"
import { renderLegal } from "../../../../workflows/legal/read"
import { kindOf } from "../../../admin/legal-documents/kind"

/**
 * GET /store/legal/:kind (F13.1): the published text as the storefront
 * shows it, the shop's details filled in. A contract's order details
 * stay blank here; the checkout shows them filled for the cart (F13.2).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const kind = kindOf(req)
  const published = await req.scope
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .versionOf(kind, "published")
  if (!published) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "legal.not_published")
  }
  res.json({
    document: {
      kind,
      version: published.version,
      title: published.title,
      html: await renderLegal(req.scope, published.body as unknown as ContentDoc),
      published_at: published.published_at,
    },
  })
}
