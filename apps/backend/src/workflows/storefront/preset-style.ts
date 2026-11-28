import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { layoutDocument } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import type { ThemeSettings } from "../../modules/platform-settings/sections"
import { readable } from "./design-shared"
import { autoSaveDraftStep } from "./design-steps"
import { LAYOUT_LOCK, saveDraftSteps } from "./layout"
import { defaultLayout } from "./layout-default"
import { layoutRow } from "./layout-row"
import { keepPageTexts } from "./page-texts-placed"
import { loadPresetStep } from "./preset-steps"
import type { ApplyPresetInput } from "./preset-steps"

/**
 * The draft with only a look's style in it (owner's decision 2026-11-28):
 * the draft's own sections, pages, menus and labels as they are, its theme
 * settings (colours, type, corners, cards, the style kit's steps) the
 * look's. Pure.
 */
export function withPresetStyle(draft: LayoutDocument, theme: ThemeSettings): LayoutDocument {
  const parsed = layoutDocument.safeParse({ ...draft, settings: { ...draft.settings, theme } })
  if (!parsed.success) {
    throw new ValidationError("storefront_preset.layout_invalid", { field: "layout" })
  }
  return parsed.data
}

/**
 * The draft as the editor opens it (the default design before the first
 * save) with the look's theme in place of its own; an older page's text
 * kept where it stood (adr/0073 Ek 2026-11-19 (2) K1). Reads only, under
 * the design's lock: the draft is written next. A draft today's schema no
 * longer reads is not overwritten with a guess.
 */
const composeStyleDraftStep = createStep(
  "storefront-preset-style-compose",
  async (theme: ThemeSettings, { container }) => {
    const row = await layoutRow(container)
    const draft = row ? readable(row.draft) : await defaultLayout(container)
    if (!draft) {
      throw new ValidationError("storefront_preset.draft_unreadable", { field: "draft" })
    }
    return new StepResponse(await keepPageTexts(container, withPresetStyle(draft, theme)))
  }
)

/**
 * A ready-made look's style alone into the theme editor's draft (owner's
 * decision 2026-11-28, `scope: "style"`; usually another sector's look):
 * its theme settings replace the draft's, every section, page layout and
 * menu of the draft stays, no image is brought in and no page opened. The
 * draft is kept first as `applyPresetWorkflow` keeps it (`save_as`, else
 * an automatic save); its label (`settings.preset`, `settings.design`)
 * stays, so the gallery shows the draft's own look as edited. Nothing goes
 * live. Under the design's lock from reading the draft to writing it.
 */
export const applyPresetStyleWorkflow = createWorkflow(
  "storefront-preset-style-apply",
  (input: ApplyPresetInput) => {
    const preset = loadPresetStep(input)
    acquireLockStep(LAYOUT_LOCK)
    const autoSaved = autoSaveDraftStep(
      transform({ input }, ({ input }) => ({
        actor: input.actor,
        save_as: input.save_as ?? null,
        reason: "preset_apply" as const,
      }))
    )
    const draft = composeStyleDraftStep(transform({ preset }, ({ preset }) => preset.theme))
    const saved = saveDraftSteps(
      transform({ draft }, ({ draft }) => draft.document),
      transform({ draft }, ({ draft }) => draft.carried)
    )
    releaseLockStep({ key: LAYOUT_LOCK.key })
    return new WorkflowResponse(
      transform({ preset, autoSaved, saved }, ({ preset, autoSaved, saved }) => ({
        pack: preset.pack,
        preset: preset.code,
        version: preset.version,
        scope: "style" as const,
        skipped: [] as { where: string; ref: string }[],
        dropped: [] as string[],
        kept: [] as string[],
        made_pages: [] as { ref: string; page_id: string; name: string }[],
        texts_kept: [] as { ref: string; name?: string }[],
        auto_saved: autoSaved,
        dropped_pages: saved.dropped_pages,
      }))
    )
  }
)
