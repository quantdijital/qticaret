import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { KEPT_REVISIONS } from "../../modules/storefront-layout/service"
import { layoutRow, layouts } from "./layout-row"
import type { LayoutRow } from "./layout-row"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The design written by the system, not by staff (adr/0073 Ek 2026-11-19
 * (2): a page's text moved into its sections, replaced by an import, its
 * links rewritten): the draft and, when one is live, the live design
 * together, the live one as a new revision with no author, so the live
 * page shows the same text at once and the editor's history says when.
 * Nothing else of the draft goes live: the live design is changed in
 * place, not replaced by the draft.
 */

/** What the system writes: the draft, and the live design (null: none is live, none written). */
export interface SystemLayout {
  draft: Record<string, unknown>
  published: Record<string, unknown> | null
}

/** The row as it was before the write, and the revisions it made or pruned. */
export interface SystemUndo {
  row: LayoutRow
  made: string | null
  pruned: Record<string, unknown>[]
}

/** The row, its revisions and its draft back as they were. */
export async function undoSystemLayout(container: Container, undo: SystemUndo): Promise<void> {
  const service = layouts(container)
  const { row } = undo
  await service.updateStorefrontLayouts({
    id: row.id,
    draft: row.draft as Record<string, unknown>,
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
 * Writes the draft and the live design over `row` (read under the
 * design's lock by the caller); a live one written is the next revision,
 * the oldest past those kept removed. A write failing part-way is put
 * back before the error goes on.
 */
export async function writeSystemLayout(
  container: Container,
  row: LayoutRow,
  next: SystemLayout
): Promise<SystemUndo> {
  const service = layouts(container)
  const undo: SystemUndo = { row, made: null, pruned: [] }
  try {
    if (next.published === null || row.published === null) {
      await service.updateStorefrontLayouts({ id: row.id, draft: next.draft })
      return undo
    }
    const revision = row.revision + 1
    const now = new Date()
    await service.updateStorefrontLayouts({
      id: row.id,
      draft: next.draft,
      published: next.published,
      published_at: now,
      published_by: null,
      revision,
    })
    const made = await service.createStorefrontLayoutRevisions({
      revision,
      document: next.published,
      published_at: now,
      published_by: null,
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
    return undo
  } catch (error) {
    await undoSystemLayout(container, undo)
    throw error
  }
}

/**
 * What a system step changes in the design: given the row as stored, the
 * draft and live documents it becomes, or null for no change.
 */
export type SystemChange<I> = (
  container: Container,
  row: LayoutRow,
  input: I
) => Promise<SystemLayout | null>

/**
 * A system write as a step (under the caller's `LAYOUT_LOCK`): `change`
 * read against the row as stored, written, undone as it was. No design
 * yet, or no change: nothing written. Answers whether the live design
 * changed (its publication is then news).
 */
export const systemLayoutStep = <I>(name: string, change: SystemChange<I>) =>
  createStep(
    name,
    async (input: I, { container }) => {
      const row = await layoutRow(container)
      const next = row ? await change(container, row, input) : null
      if (!row || !next) {
        return new StepResponse({ live: false }, null)
      }
      const undo = await writeSystemLayout(container, row, next)
      return new StepResponse({ live: undo.made !== null }, undo)
    },
    async (undo, { container }) => {
      if (undo) {
        await undoSystemLayout(container, undo)
      }
    }
  )

/** A system write to record: why, the design, the live revision it made (none: null), the pages. */
export interface SystemWrite {
  reason: "import" | "link_rewrite"
  /** The design's id; null: nothing was written, nothing is recorded. */
  layout_id: string | null
  revision: number | null
  pages: string[]
}

/** What a system write's undo says of it, for its record. */
export const systemWriteOf = (
  undo: SystemUndo | null
): { layout_id: string | null; revision: number | null } => ({
  layout_id: undo?.row.id ?? null,
  revision: undo?.made ? undo.row.revision + 1 : null,
})

/**
 * The system's write to the design recorded (security review S6), as the
 * conversion's is: why, the pages by id, the live revision it made; never
 * a page's text or title. Run as a workflow's last write, so a failing
 * record undoes the writes before it.
 */
export const recordSystemLayoutStep = createStep(
  "storefront-layout-system-record",
  async (write: SystemWrite, { container }) => {
    if (write.layout_id === null) {
      return new StepResponse(false)
    }
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "storefront.layout_system_write",
      actor_type: "system",
      resource_type: "storefront_layout",
      resource_id: write.layout_id,
      changes: { reason: write.reason, revision: write.revision, pages: write.pages },
    })
    return new StepResponse(true)
  }
)
