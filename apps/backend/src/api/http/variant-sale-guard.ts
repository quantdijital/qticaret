import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ConflictError } from "../../lib/errors"
import { VARIANT_SALE } from "../../workflows/pricing/variant-sale/plan"
import { isVariantSaleList, variantSaleListIds } from "../../workflows/pricing/variant-sale/read"
import { withoutOwned } from "./wholesale-guard"

/**
 * Medusa's list of price lists leaves out the variants' own sale lists
 * (adr/0086): one per variant on sale, shown and edited on the product's
 * page, not among the shop's price lists. Left out of the query (beside
 * any wholesale ids already left out) and out of the answer in any case.
 */
export async function hideVariantSaleLists(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const ids = await variantSaleListIds(req.scope)
    if (ids.size === 0) {
      next()
      return
    }
    const filters = req.filterableFields as Record<string, unknown> | undefined
    const asked = filters?.["id"]
    if (filters && asked === undefined) {
      filters["id"] = { $nin: [...ids] }
    } else if (filters && typeof asked === "object" && asked !== null && "$nin" in asked) {
      const left: unknown = (asked as { $nin?: unknown }).$nin
      const kept = Array.isArray(left) ? (left as unknown[]) : []
      filters["id"] = { $nin: [...kept, ...ids] }
    }
    const send = res.json.bind(res)
    res.json = (body: unknown) => send(withoutOwned(body, "price_lists", ids))
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * A variant's sale list is written only through the product's sale
 * prices (adr/0086): a write through Medusa's own price list routes, or
 * ours, would leave its mark and its price apart. `variant_sale.managed`, 409.
 */
export async function guardVariantSaleLists(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const id = req.params["id"]
    // Nor may a list be given our mark from outside: it would be hidden and locked
    const meta = (req.body as { metadata?: unknown } | undefined)?.metadata
    const marked =
      typeof meta === "object" && meta !== null && "managed_by" in meta
        ? (meta as { managed_by?: unknown }).managed_by === VARIANT_SALE
        : false
    if (marked || (id && (await isVariantSaleList(req.scope, id)))) {
      next(new ConflictError("variant_sale.managed"))
      return
    }
    next()
  } catch (error) {
    next(error)
  }
}

/** The routes the two guard, for `middlewares.ts`. */
export const VARIANT_SALE_ROUTES = [
  {
    matcher: "/admin/price-lists",
    methods: ["GET" as const],
    middlewares: [hideVariantSaleLists],
  },
  {
    matcher: "/admin/price-lists",
    methods: ["POST" as const],
    middlewares: [guardVariantSaleLists],
  },
  ...["/admin/price-lists/:id", "/admin/price-lists/:id/*"].map((matcher) => ({
    matcher,
    methods: ["POST" as const, "DELETE" as const],
    middlewares: [guardVariantSaleLists],
  })),
]
