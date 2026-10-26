import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { publishGate } from "../../workflows/seo/advisor/publish-gate"

/**
 * The SEO publish gate on the product route (docs/14 §2, flag
 * `seo.publish_gate`): taking a product live is refused while it has a
 * critical finding or scores below 50. Only the step to published is
 * gated: a live product can still be edited, and a draft saved. The
 * product is judged as stored, before this request's other changes.
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
    const isBlocked = await publishGate(req.scope)
    if (!isBlocked) {
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
    if (await isBlocked(id)) {
      throw new ValidationError("seo.publish_gate_blocked", { field: "status" })
    }
    next()
  } catch (error) {
    next(error)
  }
}
