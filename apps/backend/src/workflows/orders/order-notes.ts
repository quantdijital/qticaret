import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ORDER_NOTES_MODULE } from "../../modules/order-notes"
import type OrderNotesModuleService from "../../modules/order-notes/service"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"

type Container = Pick<MedusaContainer, "resolve">

export interface AddOrderNoteInput {
  order_id: string
  author_id: string
  body: string
}

export interface RemoveOrderNoteInput {
  order_id: string
  note_id: string
  actor_id: string
}

const notesOf = (container: Container) =>
  container.resolve<OrderNotesModuleService>(ORDER_NOTES_MODULE)

/** Whether the staff member may remove any note, not only their own: the owner. */
const removesAny = async (container: Container, userId: string) =>
  (await container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId)) === "owner"

async function assertOrder(container: Container, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id"],
    filters: { id: orderId },
  })
  if (data.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
}

/** The note on the order it names; undone by removing it. */
export const createOrderNoteStep = createStep(
  "order-notes-create",
  async (input: AddOrderNoteInput, { container }) => {
    await assertOrder(container, input.order_id)
    const note = await notesOf(container).createOrderNotes(input)
    return new StepResponse(note, note.id)
  },
  async (id, { container }) => {
    if (id) {
      await notesOf(container).deleteOrderNotes([id])
    }
  }
)

/**
 * Removes a note of the order: its author's own, or any for the owner
 * (F12.8). Its text goes, it may name the customer; the row keeps who
 * removed it. Undone by bringing it back as it was.
 */
export const removeOrderNoteStep = createStep(
  "order-notes-remove",
  async (input: RemoveOrderNoteInput, { container }) => {
    const service = notesOf(container)
    const [note] = await service.listOrderNotes(
      { id: input.note_id, order_id: input.order_id },
      { take: 1, select: ["id", "author_id", "body"] }
    )
    if (!note) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.note_unknown")
    }
    if (note.author_id !== input.actor_id && !(await removesAny(container, input.actor_id))) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, "orders.note_not_yours")
    }
    await service.updateOrderNotes({ id: note.id, body: "", removed_by: input.actor_id })
    await service.softDeleteOrderNotes([note.id])
    return new StepResponse({ id: note.id }, { id: note.id, body: note.body })
  },
  async (removed, { container }) => {
    if (removed) {
      const service = notesOf(container)
      await service.restoreOrderNotes([removed.id])
      await service.updateOrderNotes({ id: removed.id, body: removed.body, removed_by: null })
    }
  }
)

/** A staff member's note on an order (F12.8). */
export const addOrderNoteWorkflow = createWorkflow(
  "order-notes-add",
  (input: AddOrderNoteInput) => new WorkflowResponse(createOrderNoteStep(input))
)

/** Removes a note: the author's own, or any for the owner (F12.8). */
export const removeOrderNoteWorkflow = createWorkflow(
  "order-notes-remove",
  (input: RemoveOrderNoteInput) => new WorkflowResponse(removeOrderNoteStep(input))
)

// More than any order gathers
const NOTES_SHOWN = 100

export interface OrderNoteView {
  id: string
  body: string
  created_at: string
  /** Null when the author is no longer on the team. */
  author: { id: string; name: string } | null
  /** Whether the staff member reading may remove it. */
  deletable: boolean
}

/**
 * The order's latest notes, oldest first, each with its author's name and
 * whether the reader may remove it. Staff names only; never their e-mail.
 */
export async function orderNotes(
  container: Container,
  orderId: string,
  readerId: string
): Promise<OrderNoteView[]> {
  await assertOrder(container, orderId)
  // The latest when there are more, shown oldest first
  const notes = (
    await notesOf(container).listOrderNotes(
      { order_id: orderId },
      {
        take: NOTES_SHOWN,
        order: { created_at: "DESC" },
        select: ["id", "body", "author_id", "created_at"],
      }
    )
  ).reverse()
  const authorIds = [...new Set(notes.map((note) => note.author_id))]
  const users = authorIds.length
    ? await container
        .resolve(Modules.USER)
        .listUsers({ id: authorIds }, { select: ["id", "first_name", "last_name"] })
    : []
  const names = new Map(
    users.map((user) => [
      user.id,
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim(),
    ])
  )
  const any = notes.some((note) => note.author_id !== readerId)
    ? await removesAny(container, readerId)
    : false
  return notes.map((note) => {
    const name = names.get(note.author_id)
    return {
      id: note.id,
      body: note.body,
      created_at: new Date(note.created_at).toISOString(),
      author: name === undefined ? null : { id: note.author_id, name },
      deletable: note.author_id === readerId || any,
    }
  })
}
