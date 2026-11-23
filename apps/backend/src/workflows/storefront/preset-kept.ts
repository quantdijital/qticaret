import type { MedusaContainer } from "@medusajs/framework/types"
import { layoutDocument, storedDocument } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import type { ShopFrame } from "../../lib/storefront/presets/document"
import { shopSettingsOf } from "./design-steps"
import { defaultLayout } from "./layout-default"
import { layoutRow } from "./layout-row"
import { liveMenus } from "./preset-lookups"

/**
 * The draft's header and footer as the editor shows them (the default
 * design's before the first save): kept where the preset leaves the group
 * empty (`withShopFrame`); with its content pages' layouts, kept on every
 * page the preset does not lay out (`withShopPages`). A draft today's
 * schema no longer reads keeps none.
 */
async function shopFrame(
  container: MedusaContainer,
  row: Awaited<ReturnType<typeof layoutRow>>
): Promise<ShopFrame & { pages: LayoutDocument["pages"] }> {
  if (!row) {
    const { header, footer } = await defaultLayout(container)
    return { header, footer, pages: [] }
  }
  const parsed = layoutDocument.safeParse(storedDocument(row.draft))
  return parsed.success
    ? { header: parsed.data.header, footer: parsed.data.footer, pages: parsed.data.pages }
    : { header: [], footer: [], pages: [] }
}

/**
 * The draft's own parts a preset keeps: the trust badges, colour swatches
 * and "Az kaldı"; the shop's header and footer where the preset leaves
 * them empty (`withShopFrame`); with the shop's live menus, kept where the
 * preset leaves a place (`resolveMenus`). Read for the draft it writes
 * under the design's lock (`composePresetDraftStep`), so an editor's save
 * just before is kept.
 */
export async function keptSettings(container: MedusaContainer) {
  const [row, live] = await Promise.all([layoutRow(container), liveMenus(container)])
  const frame = await shopFrame(container, row)
  return { settings: shopSettingsOf(row?.draft ?? null), live, frame }
}

/** What a preset keeps of the shop's draft (`keptSettings`). */
export type KeptSettings = Awaited<ReturnType<typeof keptSettings>>
