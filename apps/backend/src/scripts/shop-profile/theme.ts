import { isDeepStrictEqual } from "node:util"
import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../lib/logging"
import { readStoredLayout } from "../../lib/storefront/layout"
import { storedSettings } from "../../lib/storefront/layout-settings"
import { saveLayoutDraftWorkflow } from "../../workflows/storefront/layout"
import { layoutRow } from "../../workflows/storefront/layout-row"
import { legacySettings } from "../../workflows/storefront/layout-shared"
import type { LoadedProfile } from "./profile"

/**
 * A profile's `theme` section carried into the design (adr/0063 §3): the
 * storefront reads the theme from the design once the design holds one,
 * the section only while it holds none. So when the design's draft or
 * live copy has a theme, the section the profile just saved is written
 * into the draft as well, the rest of the draft as it is. It goes live
 * with the next publication, as every theme change now does; nothing is
 * published here. A shop whose design holds no theme needs nothing more.
 * A draft whose theme differs from the live one holds the owner's change
 * not yet published: it is kept, never overwritten, and a warning says so.
 * Returns whether the draft was written.
 */
export async function carryProfileTheme(
  container: MedusaContainer,
  loaded: LoadedProfile
): Promise<boolean> {
  if (!Object.hasOwn(loaded.profile.sections, "theme")) {
    return false
  }
  const row = await layoutRow(container)
  const live = row?.published ? storedSettings(row.published).theme : null
  const drafted = row ? storedSettings(row.draft).theme : null
  if (!row || (drafted === null && live === null)) {
    return false
  }
  if (drafted !== null && !isDeepStrictEqual(drafted, live)) {
    logger.warn(
      { event: "shop_profile.theme_draft_kept" },
      "the design's draft holds an unpublished theme change: the profile's theme was not written into it"
    )
    return false
  }
  const { theme } = await legacySettings(container)
  const draft = readStoredLayout(row.draft)
  await saveLayoutDraftWorkflow(container).run({
    input: { ...draft, settings: { ...draft.settings, theme } },
  })
  logger.warn(
    { event: "shop_profile.theme_drafted", live_theme: live !== null },
    "theme written into the design's draft: publish it in the theme editor to show it"
  )
  return true
}
