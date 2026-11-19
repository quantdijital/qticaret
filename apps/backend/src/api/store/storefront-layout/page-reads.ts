import type { MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PAGE_ID, readStoredLayout } from "../../../lib/storefront/layout"
import type { layoutRow } from "../../../workflows/storefront/layout"
import { contentPageOf, storePageLayout } from "../../../workflows/storefront/layout-page-read"
import type { ShownPage } from "../../../workflows/storefront/layout-page-read"

type Row = NonNullable<Awaited<ReturnType<typeof layoutRow>>>

/**
 * The content page a per-page read names (adr/0073 §6): a page's id
 * (`cnt_…`), never a post's. A malformed one, or none such, is a 404.
 * `live` says whether the page is published now.
 */
export async function namedPage(req: MedusaStoreRequest): Promise<{ id: string; live: boolean }> {
  const id = req.params["id"] ?? ""
  const page = PAGE_ID.test(id) ? await contentPageOf(req.scope, id) : null
  if (!page) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
  }
  return page
}

/** A content page's layout in the draft as the storefront would show it (signed link, live session). */
export const draftPageLayout = (
  req: MedusaStoreRequest,
  row: Row,
  id: string
): Promise<ShownPage> =>
  storePageLayout(
    req.scope,
    readStoredLayout(row.draft),
    id,
    req.publishable_key_context.sales_channel_ids
  )
