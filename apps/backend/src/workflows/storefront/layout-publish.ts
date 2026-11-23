import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { acquireLocksStep } from "../locking/acquire-locks"
import { releaseLocksStep } from "../locking/release-locks"
import { ValidationError } from "../../lib/errors"
import { readStoredLayout } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import type StorefrontLayoutModuleService from "../../modules/storefront-layout/service"
import { KEPT_REVISIONS } from "../../modules/storefront-layout/service"
import { CONTENT_LOCK, CONTENT_SAVED } from "../content/workflows"
import { LAYOUT_LOCK, LAYOUT_PUBLISHED, checkLayoutStep } from "./layout"
import { json, layoutRow, layouts } from "./layout-row"
import type { LayoutRow } from "./layout-row"
import { prunePagesStep } from "./layout-pages"
import { clearDraftMenusStep } from "./layout-steps"
import { MENUS_LOCK } from "./menus"
import { replaceMenusStep } from "./menus-replace"
import { mirrorsOf, textPages, writeMirrorsStep } from "./page-mirror"
import { keepPageTexts } from "./page-texts-placed"
import { pagesLiveStep } from "./pages-live"
import { refreshStorefrontStep } from "./steps/refresh-storefront"

export interface PublishLayoutInput {
  /** The staff member publishing; null: a script. */
  actor: string | null
  /** Content pages in draft that go live with the design (adr/0073 Ek 2026-11-19 (2) K5). */
  pages_live?: string[]
}

/**
 * The draft to publish, read through today's schema, and the pages whose
 * text the live design holds as sections now (their mirror is the
 * publication's to keep, adr/0073 Ek 2026-11-19 (2) K2); none saved yet:
 * nothing to publish.
 */
const loadDraftStep = createStep(
  "storefront-layout-load-draft",
  async (_: undefined, { container }) => {
    const row = await layoutRow(container)
    if (!row) {
      throw new ValidationError("storefront_layout.nothing_to_publish", { field: "document" })
    }
    let live: LayoutDocument | null
    try {
      live = row.published ? readStoredLayout(row.published) : null
    } catch {
      // A live design that no longer reads holds no page text to keep
      live = null
    }
    // A draft never saved since a page's text became a section keeps that text (K1)
    const { document: draft, carried } = await keepPageTexts(container, readStoredLayout(row.draft))
    return new StepResponse({ draft, carried, text_pages: textPages(live) })
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
 * image it names may have gone since it was saved (a card in a text is
 * not: one gone is left out when drawn, adr/0073 Ek 2026-11-19 (2) K2).
 * The storefront shows it within its cache's minute; the theme's settings
 * with it (adr/0063 §3). A menu set the draft carries replaces the shop's
 * menus under the menus' lock and is then cleared from the draft. Each
 * content page whose published text changed gets its `body` mirror (K2),
 * and the pages in draft named in `pages_live` go live (K5); each is news
 * for the advisor (`content.saved`) and the storefront. Any step failing
 * puts the design, the menus, the draft and the pages back as they were.
 */
export const publishLayoutWorkflow = createWorkflow(
  "storefront-layout-publish",
  (input: PublishLayoutInput) => {
    // The design's and the menus' locks at once: the Menüler screen waits for a set going
    // live; the content's too: a page's mirror and status are written here
    const keys = [LAYOUT_LOCK.key, MENUS_LOCK.key, CONTENT_LOCK.key]
    const locks = { ...LAYOUT_LOCK, key: keys }
    const held = acquireLocksStep(locks)
    const loaded = loadDraftStep()
    // A content page deleted since the save goes live without its layout (adr/0073 §1)
    const pruned = prunePagesStep(transform({ loaded }, ({ loaded }) => loaded.draft))
    const draft = transform({ pruned }, ({ pruned }) => pruned.document)
    checkLayoutStep(
      transform({ draft, loaded }, ({ draft, loaded }) => ({
        draft,
        known: "self" as const,
        carried: loaded.carried,
      }))
    )
    const published = publishStep(
      transform({ draft, input }, ({ draft, input }) => ({ draft, actor: input.actor }))
    )
    const mirrored = writeMirrorsStep(
      transform({ draft, loaded }, ({ draft, loaded }) =>
        [...mirrorsOf(draft.pages, new Set(loaded.text_pages))].map(([id, doc]) => ({ id, doc }))
      )
    )
    const live = pagesLiveStep(transform({ input }, ({ input }) => input.pages_live ?? []))
    const set = transform({ draft }, ({ draft }) => draft.settings.menus)
    const menus = replaceMenusStep(set)
    clearDraftMenusStep(draft)
    emitEventStep({ eventName: LAYOUT_PUBLISHED, data: published })
    const saved = transform({ mirrored, live }, ({ mirrored, live }) => {
      const ids = new Set(live.map((each) => each.id))
      return [...live, ...mirrored.filter((each) => !ids.has(each.id))]
    })
    emitEventStep({ eventName: CONTENT_SAVED, data: saved }).config({
      name: "storefront-layout-publish-content-saved",
    })
    releaseLocksStep(held)
    refreshStorefrontStep(
      transform({ menus, saved }, ({ menus, saved }) => [
        ...(menus.replaced ? ["menus" as const] : []),
        ...(saved.length > 0 ? ["content" as const] : []),
      ])
    )
    return new WorkflowResponse(
      transform({ published, pruned }, ({ published, pruned }) => ({
        ...published,
        dropped_pages: pruned.dropped_pages,
      }))
    )
  }
)
