import { MedusaError } from "@medusajs/framework/utils"
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
import { readable, withDesignMark } from "./design-shared"
import type { DesignRef } from "./design-shared"
import { autoSaveDraftStep, keptShopSettings } from "./design-steps"
import { LAYOUT_LOCK, saveDraftSteps } from "./layout"
import { layouts } from "./layout-row"
import { placePageTextsStep } from "./page-texts-placed"
import { legacyTextAt } from "../../lib/storefront/layout-pages-stored"
import { legacySettings } from "./layout-shared"

export interface ApplyDesignInput {
  id: string
  /** The staff member applying it. */
  actor: string | null
  /** The draft kept under this name first; none: an automatic save. */
  save_as: string | null
}

interface LoadedDesign extends DesignRef {
  document: LayoutDocument
  /** Where its pages from before their text was a section keep it (adr/0073 Ek 2026-11-19 (2) K6). */
  text_at: Record<string, number>
}

/** The saved look, read through today's schema: gone is unknown, one that no longer reads says so. */
const loadDesignStep = createStep(
  "storefront-design-load",
  async (input: ApplyDesignInput, { container }) => {
    const [row] = await layouts(container).listStorefrontDesigns(
      { id: input.id },
      { select: ["id", "kind", "name", "document"], take: 1 }
    )
    if (!row) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_design.unknown")
    }
    const document = readable(row.document)
    if (!document) {
      throw new ValidationError("storefront_design.unreadable", { field: "id" })
    }
    const loaded: LoadedDesign = {
      id: row.id,
      kind: row.kind,
      name: row.name ?? null,
      document,
      text_at: legacyTextAt(row.document),
    }
    return new StepResponse(loaded)
  }
)

/**
 * The draft the saved look makes (adr/0064 §4): its sections and theme,
 * the draft's own trust badges, swatches and "Az kaldı" kept, no menu set
 * (the shop's menus stay as they are), labelled with the look's id. Reads
 * only, under the design's lock.
 */
const composeDesignDraftStep = createStep(
  "storefront-design-compose",
  async (design: LoadedDesign, { container }) => {
    const [kept, legacy] = await Promise.all([
      keptShopSettings(container),
      legacySettings(container),
    ])
    const doc: LayoutDocument = {
      ...design.document,
      settings: { ...design.document.settings, ...kept, menus: null },
    }
    const parsed = layoutDocument.safeParse(withDesignMark(doc, design.id, legacy))
    if (!parsed.success) {
      throw new ValidationError("storefront_design.unreadable", { field: "id" })
    }
    return new StepResponse(parsed.data)
  }
)

/** When the look was last brought into the draft; undone, as it was. */
const markAppliedStep = createStep(
  "storefront-design-mark-applied",
  async (id: string, { container }) => {
    const service = layouts(container)
    const [row] = await service.listStorefrontDesigns(
      { id },
      { select: ["id", "applied_at"], take: 1 }
    )
    await service.updateStorefrontDesigns({ id, applied_at: new Date() })
    return new StepResponse(undefined, { id, applied_at: row?.applied_at ?? null })
  },
  async (undo, { container }) => {
    if (undo) {
      await layouts(container).updateStorefrontDesigns({
        id: undo.id,
        applied_at: undo.applied_at,
      })
    }
  }
)

/**
 * A saved look brought into the theme editor's draft (adr/0064 §4, Ek
 * 2026-11-17): the draft kept first (named with `save_as`, else an
 * automatic save), then replaced with the look and checked as any draft
 * (a record it names that is gone refuses it whole: nothing changes, the
 * automatic save undone). Nothing goes live: publishing is its own step.
 * Under the design's lock from reading the draft to writing it.
 */
export const applyDesignWorkflow = createWorkflow(
  "storefront-design-apply",
  (input: ApplyDesignInput) => {
    acquireLockStep(LAYOUT_LOCK)
    const design = loadDesignStep(input)
    const autoSaved = autoSaveDraftStep(
      transform({ input }, ({ input }) => ({
        actor: input.actor,
        save_as: input.save_as,
        reason: "design_apply" as const,
        keep: input.id,
      }))
    )
    const composed = composeDesignDraftStep(design)
    // A look saved before a page's text was a section keeps today's text there (K6)
    const draft = placePageTextsStep(
      transform({ composed, design }, ({ composed, design }) => ({
        document: composed,
        text_at: design.text_at,
      }))
    )
    const saved = saveDraftSteps(draft)
    markAppliedStep(transform({ design }, ({ design }) => design.id))
    releaseLockStep({ key: LAYOUT_LOCK.key })
    return new WorkflowResponse(
      transform({ design, autoSaved, saved }, ({ design, autoSaved, saved }) => ({
        design: { id: design.id, kind: design.kind, name: design.name },
        auto_saved: autoSaved,
        // Content pages deleted since the look was saved, their layouts left out (adr/0073 §1)
        dropped_pages: saved.dropped_pages,
        // Pruning a look's missing records comes later (adr/0064 §5): a gone one refuses it
        skipped: [] as { where: string; ref: string }[],
        dropped: [] as string[],
      }))
    )
  }
)
