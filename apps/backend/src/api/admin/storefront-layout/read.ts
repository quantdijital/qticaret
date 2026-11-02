import type { MedusaContainer } from "@medusajs/framework/types"
import type { LayoutDocument } from "../../../lib/storefront/layout"
import { STOREFRONT_LAYOUT_MODULE } from "../../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../../modules/storefront-layout/service"
import { layoutRow } from "../../../workflows/storefront/layout"
import { defaultLayout } from "../../../workflows/storefront/layout-default"

/**
 * The theme editor's view (adr/0049): the draft (else what is live, else
 * the default design), whether it differs from what is live, and the kept
 * revisions, newest first.
 */
export async function adminLayout(container: MedusaContainer) {
  const row = await layoutRow(container)
  const revisions = await container
    .resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)
    .listStorefrontLayoutRevisions(
      {},
      { select: ["revision", "published_at", "published_by"], order: { revision: "DESC" } }
    )
  const draft = (row?.draft as LayoutDocument | undefined) ?? (await defaultLayout(container))
  return {
    draft,
    /** The design has never been saved: the draft is the default one. */
    is_default: row === null,
    has_changes: row ? JSON.stringify(row.draft) !== JSON.stringify(row.published) : false,
    revision: row?.revision ?? 0,
    published_at: row?.published_at ?? null,
    revisions,
  }
}
