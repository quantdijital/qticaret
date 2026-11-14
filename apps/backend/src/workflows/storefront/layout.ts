import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, emitEventStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { readStoredLayout } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import type StorefrontLayoutModuleService from "../../modules/storefront-layout/service"
import { KEPT_REVISIONS } from "../../modules/storefront-layout/service"
import { attachMediaStep } from "../media/steps/attach-media"
import { checkLayout } from "./layout-check"
import { defaultLayout } from "./layout-default"
import { json, layoutRow, layouts } from "./layout-row"
import type { LayoutRow } from "./layout-row"
import { checkThemeStep, clearDraftMenusStep } from "./layout-steps"
import { MENUS_LOCK } from "./menus"
import { replaceMenusStep } from "./menus-replace"
import { refreshStorefrontStep } from "./steps/refresh-storefront"

export { layoutRow } from "./layout-row"

/** Emitted when a design goes live: the storefront may forget what it holds (adr/0049). */
export const LAYOUT_PUBLISHED = "storefront.layout_published"

const LAYOUT_LOCK = { key: "storefront-layout", timeout: 10, ttl: 60 }

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

/** Checks what the design points at and returns the media it uses. */
const checkLayoutStep = createStep(
  "storefront-layout-check",
  async (draft: LayoutDocument, { container }) =>
    new StepResponse(await checkLayout(container, draft))
)

/**
 * Saves the theme editor's draft (adr/0049), as the editor saves while
 * staff work: checked, written, its images kept from the nightly sweep.
 * Nothing reaches shoppers until it is published; the theme's settings
 * and a menu set included (adr/0063 §3).
 */
export const saveLayoutDraftWorkflow = createWorkflow(
  "storefront-layout-save-draft",
  (draft: LayoutDocument) => {
    acquireLockStep(LAYOUT_LOCK)
    const media = checkLayoutStep(draft)
    checkThemeStep(draft)
    const saved = writeDraftStep(draft)
    attachMediaStep(transform({ media }, ({ media }) => ({ link: media, record: [] })))
    releaseLockStep({ key: LAYOUT_LOCK.key })
    return new WorkflowResponse(saved)
  }
)

/** The draft to publish, read through today's schema; none saved yet: nothing to publish. */
const loadDraftStep = createStep(
  "storefront-layout-load-draft",
  async (_: undefined, { container }) => {
    const row = await layoutRow(container)
    if (!row) {
      throw new ValidationError("storefront_layout.nothing_to_publish", { field: "document" })
    }
    return new StepResponse(readStoredLayout(row.draft))
  }
)

interface PublishUndo {
  row: LayoutRow
  made: string | null
  pruned: Record<string, unknown>[]
}

/** The live design and revisions as they were before a publication. */
async function unpublish(service: StorefrontLayoutModuleService, undo: PublishUndo) {
  const { row } = undo
  await service.updateStorefrontLayouts({
    id: row.id,
    published: row.published as Record<string, unknown> | null,
    published_at: row.published_at,
    published_by: row.published_by,
    revision: row.revision,
  })
  if (undo.made) {
    await service.deleteStorefrontLayoutRevisions(undo.made)
  }
  if (undo.pruned.length > 0) {
    await service.createStorefrontLayoutRevisions(undo.pruned)
  }
}

/**
 * Publishes the checked draft as the next revision; undone, the live
 * design and revisions are as they were. Its writes failing part-way are
 * put back here (the workflow undoes only a step that finished).
 */
const publishStep = createStep(
  "storefront-layout-publish",
  async ({ draft, actor }: { draft: LayoutDocument; actor: string | null }, { container }) => {
    const row = await layoutRow(container)
    if (!row) {
      throw new ValidationError("storefront_layout.nothing_to_publish", { field: "document" })
    }
    const service = layouts(container)
    const revision = row.revision + 1
    const now = new Date()
    const undo: PublishUndo = { row, made: null, pruned: [] }
    // The live copy holds no menu set: the live menus are the module's from now on, and a
    // draft going back to what is live brings none (adr/0063 §3). The revision keeps it
    const live: LayoutDocument = { ...draft, settings: { ...draft.settings, menus: null } }
    try {
      await service.updateStorefrontLayouts({
        id: row.id,
        published: json(live),
        published_at: now,
        published_by: actor,
        revision,
      })
      const made = await service.createStorefrontLayoutRevisions({
        revision,
        document: json(draft),
        published_at: now,
        published_by: actor,
      })
      undo.made = made.id
      const old = await service.listStorefrontLayoutRevisions(
        { revision: { $lte: revision - KEPT_REVISIONS } },
        { select: ["id", "revision", "document", "published_at", "published_by"] }
      )
      if (old.length > 0) {
        await service.deleteStorefrontLayoutRevisions(old.map((each) => each.id))
        undo.pruned = old
      }
    } catch (error) {
      await unpublish(service, undo)
      throw error
    }
    return new StepResponse({ revision, published_at: now }, undo)
  },
  async (undo, { container }) => {
    if (undo) {
      await unpublish(layouts(container), undo)
    }
  }
)

/**
 * Takes the draft live (adr/0049), checked again first: a record or an
 * image it names may have gone since it was saved. The storefront shows it
 * within its cache's minute; the theme's settings with it (adr/0063 §3).
 * A menu set the draft carries replaces the shop's menus under the menus'
 * lock and is then cleared from the draft; any step failing puts the
 * design, the menus and the draft back as they were.
 */
export const publishLayoutWorkflow = createWorkflow(
  "storefront-layout-publish",
  (actor: string | null) => {
    // The design's and the menus' locks at once: the Menüler screen waits for a set going live
    const locks = { ...LAYOUT_LOCK, key: [LAYOUT_LOCK.key, MENUS_LOCK.key] }
    acquireLockStep(locks)
    const draft = loadDraftStep()
    checkLayoutStep(draft)
    const published = publishStep(transform({ draft, actor }, (data) => data))
    const set = transform({ draft }, ({ draft }) => draft.settings.menus)
    const menus = replaceMenusStep(set)
    clearDraftMenusStep(draft)
    emitEventStep({ eventName: LAYOUT_PUBLISHED, data: published })
    releaseLockStep({ key: locks.key })
    refreshStorefrontStep(
      transform({ menus }, ({ menus }) => (menus.replaced ? ["menus" as const] : []))
    )
    return new WorkflowResponse(published)
  }
)

/**
 * What the draft goes back to: a revision, else what is live, else the
 * default design. A revision brings the menus it put live (adr/0063 §3)
 * unless `menus` is false.
 */
export async function draftSource(
  container: MedusaContainer,
  revision: number | null,
  menus = true
): Promise<LayoutDocument> {
  if (revision !== null) {
    const [kept] = await layouts(container).listStorefrontLayoutRevisions(
      { revision },
      { select: ["document"], take: 1 }
    )
    if (!kept) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.revision_unknown")
    }
    // Through today's schema: a document kept under an older one is checked again
    const doc = readStoredLayout(kept.document)
    return menus ? doc : { ...doc, settings: { ...doc.settings, menus: null } }
  }
  const row = await layoutRow(container)
  return row?.published ? readStoredLayout(row.published) : defaultLayout(container)
}
