import { MedusaError } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { omit } from "../../lib/omit"
import type { NoteRecord } from "../../modules/tenants/types"
import { NOTE_FIELDS } from "../../modules/tenants/types"
import { tenantsIn } from "../modules"
import { undoableStep } from "../undoable"

type Container = Parameters<typeof tenantsIn>[0]

/** Who acts on a note: the author edits and removes it, an owner any note. */
export interface NoteActor {
  id: string
  owner: boolean
}

async function ownNote(container: Container, tenantId: string, noteId: string, actor: NoteActor) {
  const [note] = (await tenantsIn(container).listTenantNotes(
    { id: noteId, tenant_id: tenantId },
    { select: [...NOTE_FIELDS], take: 1 }
  )) as unknown as NoteRecord[]
  if (!note) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.note_unknown")
  }
  if (!actor.owner && note.author_id !== actor.id) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.note_not_yours")
  }
  return note
}

export interface SaveNoteInput {
  tenant_id: string
  /** Null writes a new one. */
  note_id: string | null
  body?: string | undefined
  pinned?: boolean | undefined
  actor: NoteActor
}

const saveNoteStep = undoableStep(
  "cp-tenant-save-note",
  async (input: SaveNoteInput, container) => {
    const service = tenantsIn(container)
    const fields = {
      ...(input.body === undefined ? {} : { body: input.body }),
      ...(input.pinned === undefined ? {} : { pinned: input.pinned }),
    }
    if (!input.note_id) {
      const [made] = await service.createTenantNotes([
        { tenant_id: input.tenant_id, author_id: input.actor.id, body: "", ...fields },
      ])
      return { output: { id: made?.id ?? "" }, undo: { made: made?.id ?? "" } }
    }
    const before = await ownNote(container, input.tenant_id, input.note_id, input.actor)
    await service.updateTenantNotes({ id: before.id, ...fields })
    return { output: { id: before.id }, undo: { before } }
  },
  async (undo: { made?: string; before?: NoteRecord }, container) => {
    if (undo.made) {
      await tenantsIn(container).deleteTenantNotes([undo.made])
    } else if (undo.before) {
      const { id, body, pinned } = undo.before
      await tenantsIn(container).updateTenantNotes({ id, body, pinned })
    }
  }
)

/** A note written, edited or pinned (adr/0061 §2: plain text, up to 2000 characters). */
export const saveNoteWorkflow = createWorkflow(
  { name: "cp-tenant-save-note", store: false },
  (input: WorkflowData<SaveNoteInput>) => new WorkflowResponse(saveNoteStep(input))
)

const removeNoteStep = undoableStep(
  "cp-tenant-remove-note",
  async (input: { tenant_id: string; note_id: string; actor: NoteActor }, container) => {
    const note = await ownNote(container, input.tenant_id, input.note_id, input.actor)
    await tenantsIn(container).deleteTenantNotes([note.id])
    return { output: { id: note.id }, undo: note }
  },
  async (note: NoteRecord, container) => {
    await tenantsIn(container).createTenantNotes([omit(note, "updated_at")])
  }
)

/** A note removed: by its author, or an owner. */
export const removeNoteWorkflow = createWorkflow(
  { name: "cp-tenant-remove-note", store: false },
  (input: WorkflowData<{ tenant_id: string; note_id: string; actor: NoteActor }>) =>
    new WorkflowResponse(removeNoteStep(input))
)
