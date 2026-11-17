import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { DESIGN_ROW_FIELDS, assertNameFree, createSaved, lookOf, nameTaken } from "./design-shared"
import type { DesignRef, DesignRow } from "./design-shared"
import { LAYOUT_LOCK } from "./layout"
import { defaultLayout } from "./layout-default"
import { layoutRow, layouts } from "./layout-row"
import { legacySettings } from "./layout-shared"

type Service = ReturnType<typeof layouts>

const unknownDesign = () =>
  new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_design.unknown")

async function rowOf(service: Service, id: string): Promise<DesignRow> {
  const [row] = await service.listStorefrontDesigns(
    { id },
    { select: [...DESIGN_ROW_FIELDS], take: 1 }
  )
  if (!row) {
    throw unknownDesign()
  }
  return row
}

export interface SaveDesignInput {
  name: string
  /** A kept publication instead of the draft. */
  revision: number | null
  actor: string | null
}

/**
 * The draft (or a kept publication) kept as a named look: read on the
 * server, never taken from the request; no draft saved yet: the design the
 * editor opens (the default). Undone, it is removed.
 */
const createDesignStep = createStep(
  "storefront-design-create",
  async (input: SaveDesignInput, { container }) => {
    const service = layouts(container)
    let stored: unknown
    if (input.revision !== null) {
      const [kept] = await service.listStorefrontLayoutRevisions(
        { revision: input.revision },
        { select: ["document"], take: 1 }
      )
      if (!kept) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_layout.revision_unknown")
      }
      stored = kept.document
    } else {
      const row = await layoutRow(container)
      stored = row ? row.draft : await defaultLayout(container)
    }
    const look = await lookOf(container, stored, await legacySettings(container), "manual")
    const saved = await createSaved(service, look, input.name, input.actor)
    return new StepResponse<DesignRef, string>(saved, saved.id)
  },
  async (id, { container }) => {
    if (id) {
      await layouts(container).deleteStorefrontDesigns(id)
    }
  }
)

/** "Bu görünümü kaydet" (adr/0064 §4): under the design's lock, so the ten and the names hold. */
export const saveDesignWorkflow = createWorkflow(
  "storefront-design-save",
  (input: SaveDesignInput) => {
    acquireLockStep(LAYOUT_LOCK)
    const design = createDesignStep(input)
    releaseLockStep({ key: LAYOUT_LOCK.key })
    return new WorkflowResponse(design)
  }
)

/**
 * A saved look renamed; an automatic one given a name becomes a named one
 * (adr/0064 Ek 2026-11-17 §1), counted within the ten. Undone, as it was.
 */
const renameDesignStep = createStep(
  "storefront-design-rename",
  async (input: { id: string; name: string }, { container }) => {
    const service = layouts(container)
    const row = await rowOf(service, input.id)
    const name = input.name.trim()
    const key = await assertNameFree(service, name, row)
    await service
      .updateStorefrontDesigns({ id: row.id, kind: "saved", name, name_key: key })
      .catch(nameTaken)
    const ref: DesignRef = { id: row.id, kind: "saved", name }
    return new StepResponse(ref, { id: row.id, kind: row.kind, name: row.name, key: row.name_key })
  },
  async (undo, { container }) => {
    if (undo) {
      await layouts(container).updateStorefrontDesigns({
        id: undo.id,
        kind: undo.kind,
        name: undo.name,
        name_key: undo.key,
      })
    }
  }
)

export const renameDesignWorkflow = createWorkflow(
  "storefront-design-rename",
  (input: { id: string; name: string }) => {
    acquireLockStep(LAYOUT_LOCK)
    const design = renameDesignStep(input)
    releaseLockStep({ key: LAYOUT_LOCK.key })
    return new WorkflowResponse(design)
  }
)

/** A saved look removed for good (adr/0064 K2); undone, written back as it was. */
const deleteDesignStep = createStep(
  "storefront-design-delete",
  async (id: string, { container }) => {
    const service = layouts(container)
    const row = await rowOf(service, id)
    await service.deleteStorefrontDesigns(row.id)
    const ref: DesignRef = { id: row.id, kind: row.kind, name: row.name }
    return new StepResponse(ref, row)
  },
  async (row, { container }) => {
    if (row) {
      await layouts(container).createStorefrontDesigns(row)
    }
  }
)

export const deleteDesignWorkflow = createWorkflow("storefront-design-delete", (id: string) => {
  acquireLockStep(LAYOUT_LOCK)
  const design = deleteDesignStep(id)
  releaseLockStep({ key: LAYOUT_LOCK.key })
  return new WorkflowResponse(design)
})
