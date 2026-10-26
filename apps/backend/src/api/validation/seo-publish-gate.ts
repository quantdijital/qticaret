import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { SEO_PUBLISH_GATE } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { assessPage } from "../../workflows/seo/advisor/assess"

// docs/14 §2: below "needs work" a page is not ready for search
export const PUBLISH_GATE_SCORE = 50

/**
 * The SEO publish gate (docs/14 §2, flag `seo.publish_gate`): taking a
 * product live is refused while it has a critical finding (no price, no
 * image) or scores below 50. Only the step to published is gated: a live
 * product can still be edited, and a draft saved. The product is judged as
 * stored, before this request's other changes.
 */
export async function seoPublishGate(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const body = req.body as { status?: unknown } | undefined
    const id = (req.params as Record<string, string | undefined>)["id"]
    if (body?.status !== "published" || !id) {
      next()
      return
    }
    const settings = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    if (!(await settings.isFeatureEnabled(SEO_PUBLISH_GATE))) {
      next()
      return
    }
    const [product] = await req.scope
      .resolve(Modules.PRODUCT)
      .listProducts({ id }, { select: ["id", "status"], take: 1 })
    if (!product || product.status === "published") {
      next()
      return
    }
    const assessment = await assessPage(req.scope, "product", id)
    const critical = assessment?.issues.some((issue) => issue.severity === "critical") ?? false
    if (assessment && (critical || assessment.score < PUBLISH_GATE_SCORE)) {
      throw new ValidationError("seo.publish_gate_blocked", { field: "status" })
    }
    next()
  } catch (error) {
    next(error)
  }
}
