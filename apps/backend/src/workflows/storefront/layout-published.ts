import type { MedusaContainer } from "@medusajs/framework/types"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { readStoredLayout } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { layoutRow } from "./layout-row"
import type { LayoutEdition } from "./layout-row"

// The live design as today's schema reads it, once per revision (security review
// 2026-11-19, S2): the row and its documents (a megabyte each at most) are read only
// when a new revision is first asked for; two kept, the live one and the one before
const parsedCache = createTtlCache<LayoutDocument>({ ttlMs: 60_000, maxEntries: 2 })

/**
 * The published design for a public read that looked up its revision
 * (`layoutEdition`): read and parsed on the first ask for that revision,
 * held a minute. A publication between the two reads is the next ask's.
 */
export function publishedDocument(
  container: MedusaContainer,
  edition: LayoutEdition
): Promise<LayoutDocument> {
  return parsedCache(`revision:${String(edition.revision)}`, async () => {
    const row = await layoutRow(container)
    return readStoredLayout(row?.published ?? null)
  })
}
