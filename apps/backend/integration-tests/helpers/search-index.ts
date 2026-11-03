import type { MedusaContainer } from "@medusajs/framework/types"
import { rebuildSearchIndex } from "../../src/workflows/search/drain"

/**
 * The search index made from the catalogue as it is now (adr/0056), before
 * a listing or a search is asked. Catalogue writes reach the index through
 * their events after the request answers; a test that reads right after
 * writing indexes the whole (small) catalogue itself, so it never waits on
 * timing. The event path has its own test (search-index-events).
 */
export async function indexCatalogue(container: MedusaContainer): Promise<void> {
  await rebuildSearchIndex(container)
}
