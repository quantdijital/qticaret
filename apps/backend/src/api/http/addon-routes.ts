import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { lineAddonsOf } from "../../lib/catalog/addons"
import { ValidationError } from "../../lib/errors"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { PRODUCT_ADDONS } from "../../modules/platform-settings/features"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { StorePostLineAddons } from "../store/carts/[id]/line-items/[line_id]/addons/validators"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"

/**
 * A line carrying add-ons keeps its record (adr/0052 §4): the core line
 * route may change its quantity, within the add-ons' limit, but not its
 * metadata. Its custom price stays as Medusa keeps it (2.21.2).
 */
async function protectAddonLine(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const body = req.body as { metadata?: unknown; quantity?: unknown } | undefined
  if (req.method !== "POST" || !body) {
    next()
    return
  }
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["items.id", "items.metadata"],
      filters: { id: req.params["id"] ?? "" },
    })
    const line = (
      (data[0] as { items?: ({ id: string; metadata?: unknown } | null)[] } | undefined)?.items ??
      []
    ).find((item) => item?.id === req.params["line_id"])
    const addons = lineAddonsOf(line?.metadata)
    if (!addons) {
      next()
      return
    }
    if (body.metadata !== undefined) {
      next(new ValidationError("addons.line_locked", { field: "metadata" }))
      return
    }
    const limit = addons.max_quantity
    const quantity = typeof body.quantity === "number" ? body.quantity : 0
    next(
      limit !== null && quantity > limit
        ? new ValidationError("addons.max_quantity", { field: "quantity" })
        : undefined
    )
  } catch (error) {
    next(error)
  }
}

/**
 * Product add-ons (adr/0052), each store route behind the shop's
 * `catalog.addons` flag, which answers first. Picking a line's add-ons is
 * a cart write: the checkout's budget, per cart too.
 */
export const ADDON_ROUTES = [
  {
    matcher: "/store/products/:id/addons",
    methods: ["GET" as const],
    middlewares: [
      requireFeature(PRODUCT_ADDONS),
      validateAndTransformQuery(AdminGetDashboardNoQuery, {}),
    ],
  },
  {
    matcher: "/store/carts/:id/line-items/:line_id/addons",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(PRODUCT_ADDONS),
      rateLimit(() => RATE_LIMIT_PROFILES.checkout, { identity: (req) => req.params["id"] }),
      validateAndTransformBody(StorePostLineAddons),
    ],
  },
  {
    matcher: "/store/carts/:id/line-items/:line_id",
    middlewares: [protectAddonLine],
  },
]
