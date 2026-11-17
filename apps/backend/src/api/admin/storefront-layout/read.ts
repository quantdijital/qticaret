import type { MedusaContainer } from "@medusajs/framework/types"
import { layoutDocument, storedDocument } from "../../../lib/storefront/layout"
import type { LayoutDocument } from "../../../lib/storefront/layout"
import { STOREFRONT_LAYOUT_MODULE } from "../../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../../modules/storefront-layout/service"
import { layoutRow } from "../../../workflows/storefront/layout"
import type { LayoutRow } from "../../../workflows/storefront/layout-row"
import { defaultLayout } from "../../../workflows/storefront/layout-default"
import { storedSettings } from "../../../lib/storefront/layout-settings"
import { legacySettings, withLegacySettings } from "../../../workflows/storefront/layout-shared"

// A document as today's schema reads it (a group added since is there, empty);
// one it no longer reads is given as it is stored
export const current = (stored: unknown): LayoutDocument => {
  const parsed = layoutDocument.safeParse(storedDocument(stored))
  return parsed.success ? parsed.data : (stored as LayoutDocument)
}

/**
 * Whether the draft (as the editor opens it, `draft`) differs from what is
 * live, both as today's schema reads them: a group added since is no change.
 * Never saved: no change.
 */
export function draftChanged(
  row: LayoutRow | null,
  draft: LayoutDocument,
  legacy: Awaited<ReturnType<typeof legacySettings>>
): boolean {
  if (!row) {
    return false
  }
  const live = row.published === null ? null : withLegacySettings(current(row.published), legacy)
  return JSON.stringify(draft) !== JSON.stringify(live)
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
    .revisionSummaries()
  // Whether restoring it brings that day's menus too (adr/0063 §3): the panel says so.
  // Read as the restore reads it (`storedSettings`), from the set alone, not the document
  const revisions = kept.map((each) => ({
    revision: each.revision,
    published_at: each.published_at,
    published_by: each.published_by,
    has_menus: storedSettings({ settings: { menus: each.menus } }).menus !== null,
  }))
  const draft = withLegacySettings(
    row ? current(row.draft) : await defaultLayout(container),
    legacy
  )
  return {
    draft,
    /** The design has never been saved: the draft is the default one. */
    is_default: row === null,
    has_changes: draftChanged(row, draft, legacy),
    revision: row?.revision ?? 0,
    published_at: row?.published_at ?? null,
    revisions,
  }
}
