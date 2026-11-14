import type { MedusaContainer } from "@medusajs/framework/types"
import { layoutDocument, storedDocument } from "../../../lib/storefront/layout"
import type { LayoutDocument } from "../../../lib/storefront/layout"
import { STOREFRONT_LAYOUT_MODULE } from "../../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../../modules/storefront-layout/service"
import { layoutRow } from "../../../workflows/storefront/layout"
import { defaultLayout } from "../../../workflows/storefront/layout-default"
import { storedSettings } from "../../../lib/storefront/layout-settings"
import { legacySettings, withLegacySettings } from "../../../workflows/storefront/layout-shared"

// A document as today's schema reads it (a group added since is there, empty);
// one it no longer reads is given as it is stored
const current = (stored: unknown): LayoutDocument => {
  const parsed = layoutDocument.safeParse(storedDocument(stored))
  return parsed.success ? parsed.data : (stored as LayoutDocument)
}

/**
 * The theme editor's view (adr/0049): the draft (else what is live, else
 * the default design), whether it differs from what is live, and the kept
 * revisions, newest first. The theme's shared settings not yet written in
 * the design read as their old fields hold them (adr/0049 Ek 2026-11-06),
 * on the draft and on what is live alike: no change until the shop makes one.
 * So does the theme (adr/0063 §3), from the theme section. A menu set the
 * draft carries is given as it is; each revision says whether it has one.
 */
export async function adminLayout(container: MedusaContainer) {
  const [row, legacy] = await Promise.all([layoutRow(container), legacySettings(container)])
  const kept = await container
    .resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)
    .listStorefrontLayoutRevisions(
      {},
      {
        select: ["revision", "published_at", "published_by", "document"],
        order: { revision: "DESC" },
      }
    )
  // Whether restoring it brings that day's menus too (adr/0063 §3): the panel says so
  const revisions = kept.map((each) => ({
    revision: each.revision,
    published_at: each.published_at,
    published_by: each.published_by,
    has_menus: storedSettings(each.document).menus !== null,
  }))
  const draft = withLegacySettings(
    row ? current(row.draft) : await defaultLayout(container),
    legacy
  )
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
