import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { storedSettings, withLegacy } from "../../lib/storefront/layout-settings"
import { themeSaveIssue } from "../../modules/platform-settings/sections/theme"
import { legacySettings } from "./layout-shared"
import { layoutRow, layouts } from "./layout-row"

/**
 * The theme's save rule (adr/0062 §6) for the design's theme (adr/0063
 * §3): a draft that changes the main colour or the page colour to a pair
 * the page's well cannot carry is refused, as a save of the theme section
 * is. Judged against the draft as stored (an unset theme as the theme
 * section holds it), so a colour from before the rule keeps saving until
 * the shop changes it. The contrast rule itself is the schema's.
 */
export const checkThemeStep = createStep(
  "storefront-layout-check-theme",
  async (draft: LayoutDocument, { container }) => {
    const after = draft.settings.theme
    if (after) {
      const [row, legacy] = await Promise.all([layoutRow(container), legacySettings(container)])
      const before = withLegacy(storedSettings(row?.draft ?? null), legacy).theme
      const issue = before ? themeSaveIssue(after, before) : null
      if (issue) {
        throw new ValidationError(issue.message, {
          field: `settings.theme.${issue.path.join(".")}`,
        })
      }
    }
    return new StepResponse(undefined)
  }
)

/**
 * The draft's menu set cleared once it is live (adr/0063 §3): a later
 * publication then leaves alone what the Menüler screen changes meanwhile.
 * Undone, the draft is as it was. No set: nothing to clear.
 */
export const clearDraftMenusStep = createStep(
  "storefront-layout-clear-draft-menus",
  async (draft: LayoutDocument, { container }) => {
    const row = draft.settings.menus ? await layoutRow(container) : null
    if (!row) {
      return new StepResponse(undefined, null)
    }
    const stored = row.draft as Record<string, unknown>
    const settings = (stored["settings"] ?? {}) as Record<string, unknown>
    await layouts(container).updateStorefrontLayouts({
      id: row.id,
      draft: { ...stored, settings: { ...settings, menus: null } },
    })
    return new StepResponse(undefined, { id: row.id, draft: stored })
  },
  async (undo, { container }) => {
    if (undo) {
      await layouts(container).updateStorefrontLayouts({ id: undo.id, draft: undo.draft })
    }
  }
)
