import type { MedusaContainer } from "@medusajs/framework/types"
import { DESIGN_LIMITS } from "../../../lib/storefront/designs/limits"
import { storedSettings } from "../../../lib/storefront/layout-settings"
import type { DesignSummaryRow } from "../../../modules/storefront-layout/service"
import { isEdited } from "../../../workflows/storefront/design-shared"
import { layoutRow, layouts } from "../../../workflows/storefront/layout-row"
import { legacySettings, withLegacySettings } from "../../../workflows/storefront/layout-shared"
import { current, draftChanged } from "../storefront-layout/read"

/** A saved look's card (adr/0064 §8): never its document. */
export function designCard(
  row: DesignSummaryRow,
  marks: { draft: string | null; live: string | null; edited: boolean }
) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    summary: row.summary,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    applied_at: row.applied_at,
    /** The draft was last given this look. */
    in_draft: marks.draft === row.id,
    /** What is live was last given this look. */
    live: marks.live === row.id,
    /** In the draft and changed there since. */
    edited: marks.draft === row.id && marks.edited,
  }
}

/**
 * The gallery's saved looks and where the design stands (adr/0064 Ek
 * 2026-11-17 §2.1): the draft's and the live design's look (a ready-made
 * one by `preset`, a saved one by `design_id`), whether the draft changed
 * since its look was applied and since what is live. No documents.
 */
export async function designGallery(container: MedusaContainer) {
  const [row, legacy, rows] = await Promise.all([
    layoutRow(container),
    legacySettings(container),
    layouts(container).designSummaries(),
  ])
  const draft = storedSettings(row?.draft ?? null)
  const live = storedSettings(row?.published ?? null)
  const edited = row ? isEdited(row.draft, legacy) : false
  const marks = { draft: draft.design?.id ?? null, live: live.design?.id ?? null, edited }
  return {
    designs: rows.map((each) => designCard(each, marks)),
    limits: { saved: DESIGN_LIMITS.saved, auto: DESIGN_LIMITS.auto },
    current: {
      draft: {
        preset: draft.preset,
        design_id: marks.draft,
        edited,
        has_changes: row
          ? draftChanged(row, withLegacySettings(current(row.draft), legacy), legacy)
          : false,
      },
      live: {
        preset: live.preset,
        design_id: marks.live,
        revision: row?.revision ?? 0,
        published_at: row?.published_at ?? null,
      },
    },
  }
}
