import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { collectionsOn } from "../../workflows/catalog/collections-flag"
import { answerAsMissing } from "../http/require-feature"
import { rejectRequest } from "../http/reject"
import { routePath } from "../http/request-path"

// A product's collection relation or its id, anywhere in a path (`items.product.collection`)
const COLLECTION_FIELD = /(^|\.)\*?collection(_id)?(\.|$)/

const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (each): each is string => typeof each === "string"
  )

/** Whether the request names a product's collection, as a field or a filter. */
export function asksCollection(query: Record<string, unknown>): boolean {
  const fields = strings(query["fields"])
    .flatMap((value) => value.split(","))
    .some((token) => COLLECTION_FIELD.test(token.trim().replace(/^[+-]/, "")))
  return fields || query["collection_id"] !== undefined
}

/**
 * `catalog.collections` off: the Store API's products neither filter by a
 * collection nor show one, so a switched-off collection's name and members
 * do not leak through them. The flag is read only when a request asks.
 */
export async function rejectOffCollectionReads(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  if (!asksCollection(req.query)) {
    next()
    return
  }
  let on: boolean
  try {
    on = await collectionsOn(req.scope)
  } catch (error) {
    next(error)
    return
  }
  if (on) {
    next()
    return
  }
  rejectRequest(
    req,
    res,
    400,
    { type: "invalid_data", message: "The requested fields are not available" },
    "store_collection_off"
  )
}

/** Which path segment names the page type (`collection`) on an SEO write route. */
const TYPE_SEGMENT = {
  // PUT /admin/seo/:entity_type/:entity_id
  meta: 3,
  // POST /admin/seo/assessments/:kind/:id/fix
  fix: 4,
} as const

/**
 * `catalog.collections` off: a collection's SEO fields and advisor fixes
 * are refused as a missing route, as its other writes are. Runs first, so
 * the body validator does not answer before it.
 */
export function refuseOffCollectionSeo(route: keyof typeof TYPE_SEGMENT) {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ): Promise<void> => {
    // The route's own parameter, else read from the path (a middleware may see none)
    const params = (req.params as Record<string, string | undefined> | undefined) ?? {}
    const type =
      params["entity_type"] ?? params["kind"] ?? routePath(req).split("/")[TYPE_SEGMENT[route]]
    if (type !== "collection") {
      next()
      return
    }
    let on: boolean
    try {
      on = await collectionsOn(req.scope)
    } catch (error) {
      next(error)
      return
    }
    if (on) {
      next()
      return
    }
    answerAsMissing(req, res, "feature_disabled")
  }
}
