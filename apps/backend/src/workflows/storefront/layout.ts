import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { readStoredLayoutTexts } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { attachMediaStep } from "../media/steps/attach-media"
import { keepDesignMarkStep } from "./design-steps"
import { checkLayout } from "./layout-check"
import { defaultLayout } from "./layout-default"
import { json, layoutRow, layouts } from "./layout-row"
import { prunePagesStep } from "./layout-pages"
import { checkThemeStep } from "./layout-steps"
import type { TextedDesign } from "./page-texts-placed"

export { layoutRow } from "./layout-row"

/** Emitted when a design goes live: the storefront may forget what it holds (adr/0049). */
export const LAYOUT_PUBLISHED = "storefront.layout_published"

/** The design's lock: every write of the draft or the live design holds it. */
export const LAYOUT_LOCK = { key: "storefront-layout", timeout: 10, ttl: 60 }

/** Writes the draft (the first save makes the record); undone, the draft is as it was. */
const writeDraftStep = createStep(
  "storefront-layout-write-draft",
  async (draft: LayoutDocument, { container }) => {
    const row = await layoutRow(container)
    const service = layouts(container)
    if (row) {
      await service.updateStorefrontLayouts({ id: row.id, draft: json(draft) })
      return new StepResponse({ id: row.id }, { id: row.id, draft: row.draft, made: false })
    }
    const made = await service.createStorefrontLayouts({ draft: json(draft) })
    return new StepResponse({ id: made.id }, { id: made.id, draft: null, made: true })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = layouts(container)
    if (undo.made) {
      await service.deleteStorefrontLayouts(undo.id)
    } else {
      await service.updateStorefrontLayouts({
        id: undo.id,
        draft: undo.draft as Record<string, unknown>,
      })
    }
  }
)

/**
 * Checks what the design points at and returns the media it uses. The
 * cards checked are those the stored draft did not hold (`stored`), or
 * none new when it is the draft itself going live (`self`).
 */
export const checkLayoutStep = createStep(
  "storefront-layout-check",
  async ({ draft, known }: { draft: LayoutDocument; known: "stored" | "self" }, { container }) => {
    const before = known === "self" ? draft : ((await layoutRow(container))?.draft ?? null)
    return new StepResponse(await checkLayout(container, draft, before))
  }
)

/**
 * Saves the theme editor's draft (adr/0049), as the editor saves while
 * staff work: checked, written, its images kept from the nightly sweep.
 * Nothing reaches shoppers until it is published; the theme's settings
 * and a menu set included (adr/0063 §3). The saved-look label is the
 * stored one: only applying a look writes it (adr/0064).
 */
export const saveLayoutDraftWorkflow = createWorkflow(
  "storefront-layout-save-draft",
  (draft: LayoutDocument) => {
    acquireLockStep(LAYOUT_LOCK)
    const saved = saveDraftSteps(keepDesignMarkStep(draft))
    releaseLockStep({ key: LAYOUT_LOCK.key })
    return new WorkflowResponse(saved)
  }
)

/**
 * The draft's save for a workflow that holds the design's lock itself
 * (`LAYOUT_LOCK`) over what it read to compose the draft: a ready-made
 * look keeping the shop's own settings (adr/0063 §4). A lock taken in a
 * workflow run as another's step is skipped, so such a caller cannot use
 * `saveLayoutDraftWorkflow.runAsStep` and be covered.
 */
export function saveDraftSteps(draft: LayoutDocument | WorkflowData<LayoutDocument>) {
  // A content page deleted since takes its layout with it (adr/0073 §1)
  const pruned = prunePagesStep(draft)
  const document = transform({ pruned }, ({ pruned }) => pruned.document)
  const media = checkLayoutStep(
    transform({ document }, ({ document }) => ({ draft: document, known: "stored" as const }))
  )
  checkThemeStep(document)
  const saved = writeDraftStep(document)
  attachMediaStep(transform({ media }, ({ media }) => ({ link: media, record: [] })))
  return transform({ saved, pruned }, ({ saved, pruned }) => ({
    ...saved,
    dropped_pages: pruned.dropped_pages,
  }))
}

/**
 * What the draft goes back to: a revision, else what is live, else the
 * default design, with where its older pages' text stands (`text_at`,
 * adr/0073 Ek 2026-11-19 (2) K6). A revision brings the menus it put live
 * (adr/0063 §3) unless `menus` is false.
 */
export async function draftSource(
  container: MedusaContainer,
  revision: number | null,
  menus = true
): Promise<TextedDesign> {
  if (revision !== null) {
    const [kept] = await layouts(container).listStorefrontLayoutRevisions(
      { revision },
      { select: ["document"], take: 1 }
    )
    if (!kept) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.revision_unknown")
    }
    // Through today's schema: a document kept under an older one is checked again
    const { document: doc, text_at } = readStoredLayoutTexts(kept.document)
    return {
      document: menus ? doc : { ...doc, settings: { ...doc.settings, menus: null } },
      text_at,
    }
  }
  const row = await layoutRow(container)
  return row?.published
    ? readStoredLayoutTexts(row.published)
    : { document: await defaultLayout(container), text_at: {} }
}
