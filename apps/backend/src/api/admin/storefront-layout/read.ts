import type { MedusaContainer } from "@medusajs/framework/types"
import { layoutDocument } from "../../../lib/storefront/layout"
import type { LayoutDocument } from "../../../lib/storefront/layout"
import { STOREFRONT_LAYOUT_MODULE } from "../../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../../modules/storefront-layout/service"
import { layoutRow } from "../../../workflows/storefront/layout"
import { defaultLayout } from "../../../workflows/storefront/layout-default"
import { legacySettings, withLegacySettings } from "../../../workflows/storefront/layout-shared"

// A document as today's schema reads it (a group added since is there, empty);
// one it no longer reads is given as it is stored
const current = (stored: unknown): LayoutDocument => {
  const parsed = layoutDocument.safeParse(stored)
  return parsed.success ? parsed.data : (stored as LayoutDocument)
}

/**
 * The theme editor's view (adr/0049): the draft (else what is live, else
 * the default design), whether it differs from what is live, and the kept
 * revisions, newest first. The theme's shared settings not yet written in
 * the design read as their old fields hold them (adr/0049 Ek 2026-11-06),
 * on the draft and on what is live alike: no change until the shop makes one.
 */
export async function adminLayout(container: MedusaContainer) {
  const [row, legacy] = await Promise.all([layoutRow(container), legacySettings(container)])
  const revisions = await container
    .resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)
    .listStorefrontLayoutRevisions(
      {},
      { select: ["revision", "published_at", "published_by"], order: { revision: "DESC" } }
    )
  const draft = row
    ? withLegacySettings(current(row.draft), legacy)
    : await defaultLayout(container)
  return {
    draft,
    /** The design has never been saved: the draft is the default one. */
    is_default: row === null,
    // Compared as today's schema reads both: a group added since is no change
    has_changes: row
      ? JSON.stringify(draft) !==
        JSON.stringify(
          row.published === null ? null : withLegacySettings(current(row.published), legacy)
        )
      : false,
    revision: row?.revision ?? 0,
    published_at: row?.published_at ?? null,
    revisions,
  }
}
