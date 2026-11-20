import type { MedusaContainer } from "@medusajs/framework/types"
import { createTtlCache } from "../../lib/cache/ttl-cache"
import { readStoredLayoutTexts } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { editionKey, layoutRow } from "./layout-row"
import type { LayoutEdition } from "./layout-row"

/** The published design as read, with where an older page's text stands (adr/0073 Ek 2026-11-19 (2) K1). */
export interface PublishedRead {
  document: LayoutDocument
  text_at: Readonly<Record<string, number>>
}

// The live design as today's schema reads it, once per revision (security review
// 2026-11-19, S2): the row and its documents (a megabyte each at most) are read only
// when a new revision is first asked for; two kept, the live one and the one before.
// Keyed on the revision and the moment it went live (`editionKey`): a number given
// back by a rolled-back publication never serves that publication's document
const parsedCache = createTtlCache<PublishedRead>({ ttlMs: 60_000, maxEntries: 2 })

/**
 * The published design for a public read that looked up its revision
 * (`layoutEdition`): read and parsed on the first ask for that revision,
 * held a minute. A publication between the two reads is the next ask's.
 */
export function publishedRead(
  container: MedusaContainer,
  edition: LayoutEdition
): Promise<PublishedRead> {
  return parsedCache(editionKey(edition), async () => {
    const row = await layoutRow(container)
    return readStoredLayoutTexts(row?.published ?? null)
  })
}

/** The published design alone (`publishedRead`). */
export const publishedDocument = async (
  container: MedusaContainer,
  edition: LayoutEdition
): Promise<LayoutDocument> => (await publishedRead(container, edition)).document
