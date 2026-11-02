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
import type { LayoutDocument } from "../../lib/storefront/layout"
import { STOREFRONT_LAYOUT_MODULE } from "../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../modules/storefront-layout/service"
import { KEPT_REVISIONS } from "../../modules/storefront-layout/service"
import { attachMediaStep } from "../media/steps/attach-media"
import { checkLayout } from "./layout-check"
import { defaultLayout } from "./layout-default"

/** Emitted when a design goes live: the storefront may forget what it holds (adr/0049). */
export const LAYOUT_PUBLISHED = "storefront.layout_published"

const LAYOUT_LOCK = { key: "storefront-layout", timeout: 10, ttl: 60 }

// The document as the JSON column takes it
const json = (doc: LayoutDocument) => doc as unknown as Record<string, unknown>

const layouts = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)

interface LayoutRow {
  id: string
  draft: unknown
  published: unknown
  published_at: Date | null
  published_by: string | null
  revision: number
}

/** The shop's one design record, if it has made one. */
export async function layoutRow(
  container: Pick<MedusaContainer, "resolve">
): Promise<LayoutRow | null> {
  const [row] = await layouts(container).listStorefrontLayouts({}, { take: 1 })
  return (row as LayoutRow | undefined) ?? null
}

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
 * Nothing reaches shoppers until it is published.
 */
export const saveLayoutDraftWorkflow = createWorkflow(
  "storefront-layout-save-draft",
  (draft: LayoutDocument) => {
    acquireLockStep(LAYOUT_LOCK)
    const media = checkLayoutStep(draft)
    const saved = writeDraftStep(draft)
    attachMediaStep(transform({ media }, ({ media }) => ({ link: media, record: [] })))
    releaseLockStep({ key: LAYOUT_LOCK.key })
    return new WorkflowResponse(saved)
  }
)

/** Publishes the draft as the next revision; undone, the live design and revisions are as they were. */
const publishStep = createStep(
  "storefront-layout-publish",
  async (actor: string | null, { container }) => {
    const row = await layoutRow(container)
    if (!row) {
      throw new ValidationError("storefront_layout.nothing_to_publish", { field: "document" })
    }
    const service = layouts(container)
    const revision = row.revision + 1
    const now = new Date()
    await service.updateStorefrontLayouts({
      id: row.id,
      published: row.draft as Record<string, unknown>,
      published_at: now,
      published_by: actor,
      revision,
    })
    const made = await service.createStorefrontLayoutRevisions({
      revision,
      document: row.draft as Record<string, unknown>,
      published_at: now,
      published_by: actor,
    })
    const old = await service.listStorefrontLayoutRevisions(
      { revision: { $lte: revision - KEPT_REVISIONS } },
      { select: ["id", "revision", "document", "published_at", "published_by"] }
    )
    if (old.length > 0) {
      await service.deleteStorefrontLayoutRevisions(old.map((each) => each.id))
    }
    return new StepResponse({ revision, published_at: now }, { row, made: made.id, pruned: old })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = layouts(container)
    const { row } = undo
    await service.updateStorefrontLayouts({
      id: row.id,
      published: row.published as Record<string, unknown> | null,
      published_at: row.published_at,
      published_by: row.published_by,
      revision: row.revision,
    })
    await service.deleteStorefrontLayoutRevisions(undo.made)
    if (undo.pruned.length > 0) {
      await service.createStorefrontLayoutRevisions(undo.pruned)
    }
  }
)

/** Takes the draft live (adr/0049); the storefront shows it within its cache's minute. */
export const publishLayoutWorkflow = createWorkflow(
  "storefront-layout-publish",
  (actor: string | null) => {
    acquireLockStep(LAYOUT_LOCK)
    const published = publishStep(actor)
    emitEventStep({ eventName: LAYOUT_PUBLISHED, data: published })
    releaseLockStep({ key: LAYOUT_LOCK.key })
    return new WorkflowResponse(published)
  }
)

/** What the draft goes back to: a revision, else what is live, else the default design. */
export async function draftSource(
  container: MedusaContainer,
  revision: number | null
): Promise<LayoutDocument> {
  if (revision !== null) {
    const [kept] = await layouts(container).listStorefrontLayoutRevisions(
      { revision },
      { select: ["document"], take: 1 }
    )
    if (!kept) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.revision_unknown")
    }
    return kept.document as unknown as LayoutDocument
  }
  const row = await layoutRow(container)
  return (row?.published as LayoutDocument | null) ?? defaultLayout(container)
}
