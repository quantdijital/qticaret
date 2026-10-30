import type { MedusaRequest } from "@medusajs/framework/http"
import { routePathKeepingCase } from "../request-path"
import { ATTRIBUTE_RESOURCES } from "./resources/attributes"
import { BRAND_RESOURCES } from "./resources/brands"
import { CATALOG_RESOURCES } from "./resources/catalog"
import { CHARGEBACK_RESOURCES } from "./resources/chargebacks"
import { CONTENT_RESOURCES } from "./resources/content"
import { GIFT_CARD_RESOURCES } from "./resources/gift-cards"
import { INTEGRATION_RESOURCES } from "./resources/integrations"
import { LEGAL_RESOURCES } from "./resources/legal"
import { ORDER_RESOURCES } from "./resources/orders"
import { MEDIA_RESOURCES } from "./resources/media"
import { PRICE_RESOURCES } from "./resources/prices"
import { PROMOTION_RESOURCES } from "./resources/promotions"
import { REDIRECT_RESOURCES } from "./resources/redirects"
import { SEO_RESOURCES } from "./resources/seo"
import { SETTINGS_RESOURCES } from "./resources/settings"
import { STAFF_RESOURCES } from "./resources/staff"
import { STOCK_RESOURCES } from "./resources/stock"
import type { AuditedResource } from "./types"
import { ID } from "./types"

/**
 * Audited resources (adr/0011): routes whose changes are summarised before
 * and after, field by field. Every phase that adds a sensitive route adds
 * its resource under `resources/` (code-reviewer checklist). Other admin
 * mutations get the names of the body fields only.
 */
export const AUDITED_RESOURCES: readonly AuditedResource[] = [
  ...PRICE_RESOURCES,
  ...SETTINGS_RESOURCES,
  ...ATTRIBUTE_RESOURCES,
  ...CATALOG_RESOURCES,
  ...PROMOTION_RESOURCES,
  ...SEO_RESOURCES,
  ...REDIRECT_RESOURCES,
  ...BRAND_RESOURCES,
  ...STOCK_RESOURCES,
  ...MEDIA_RESOURCES,
  ...CONTENT_RESOURCES,
  ...GIFT_CARD_RESOURCES,
  ...INTEGRATION_RESOURCES,
  ...ORDER_RESOURCES,
  ...CHARGEBACK_RESOURCES,
  ...STAFF_RESOURCES,
  ...LEGAL_RESOURCES,
]

export interface ResourceMatch {
  resource: AuditedResource
  params: Record<string, string>
}

const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * The path for audit records: case kept (IDs are case-sensitive) and each
 * segment decoded, as Express decodes route parameters: `prod%5F01J...`
 * reaches the handler as `prod_01J...` and must be recorded so.
 */
export const auditPath = (req: MedusaRequest): string =>
  routePathKeepingCase(req).split("/").map(decodeSegment).join("/")

/** `path` keeps its case; the patterns match without regard to it, as Express does. */
export function matchAuditedResource(
  method: string,
  path: string,
  resources: readonly AuditedResource[] = AUDITED_RESOURCES
): ResourceMatch | null {
  for (const resource of resources) {
    const match = resource.method === method ? resource.pattern.exec(path) : null
    if (match) {
      return { resource, params: { ...match.groups } }
    }
  }
  return null
}

const ID_SEGMENT = new RegExp(`^${ID}$`)

// `price-lists` → `price_list`, `product-categories` → `product_category`
const singular = (area: string): string =>
  area
    .replace(/-/g, "_")
    .replace(/ies$/, "y")
    .replace(/([^s])s$/, "$1")

/**
 * For routes not in the registry: the path with IDs as `:id`, its resource
 * type (the area, singular) and first ID. `path` keeps its case; the fixed
 * segments are written in lower case, as Express matched them.
 */
export function describeRoute(method: string, path: string) {
  const segments = path.split("/").filter(Boolean)
  const resourceId = segments.find((segment) => ID_SEGMENT.test(segment)) ?? null
  const fixed = segments.map((segment) =>
    ID_SEGMENT.test(segment) ? ":id" : segment.toLowerCase()
  )
  return {
    action: `${method} /${fixed.join("/")}`,
    resourceType: fixed[1] === undefined ? null : singular(fixed[1]),
    resourceId,
  }
}
