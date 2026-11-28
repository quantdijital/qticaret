import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { SAMPLE_RESERVED_KEYS } from "../../lib/sample-catalog/mark"

const reserved = new Set(SAMPLE_RESERVED_KEYS)

const holdsReserved = (holder: unknown): boolean => {
  if (holder === null || typeof holder !== "object") {
    return false
  }
  const metadata = (holder as { metadata?: unknown }).metadata
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    Object.keys(metadata).some((key) => reserved.has(key))
  )
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? (value as unknown[]) : [])

/**
 * The sample catalogue's marks (`sample`, `sample_of`, `sample_at`,
 * `sample_opened`, `sample_job`) are the server's (security review
 * 2026-11-28, D1): a product or category created or changed through
 * Medusa's routes, one by one or in a batch (`create`, `update`), may not
 * set one nor remove one (Medusa deletes a key sent as ""). Otherwise a
 * record of the shop's could pass for a sample and go with "Örnek içeriği
 * kaldır", or a sample stop being one and sell. Mounted on the route
 * prefixes without `methods`, so it runs before the core validates the
 * body; the core's own import is closed (`catalog-sheet-routes.ts`) and
 * the product sheet writes no metadata.
 */
export function refuseSampleMetadata(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = req.body as { create?: unknown; update?: unknown } | undefined
  const refused =
    req.method === "POST" &&
    (holdsReserved(body) ||
      listOf(body?.create).some(holdsReserved) ||
      listOf(body?.update).some(holdsReserved))
  next(
    refused
      ? new ValidationError("sample_catalog.metadata_reserved", { field: "metadata" })
      : undefined
  )
}

/** Medusa's product and category routes, every path below them included. */
export const SAMPLE_METADATA_ROUTES = ["/admin/products", "/admin/product-categories"].map(
  (matcher) => ({ matcher, middlewares: [refuseSampleMetadata] })
)
