import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ORDER_NOTES_MODULE } from "../../modules/order-notes"
import type OrderNotesModuleService from "../../modules/order-notes/service"

type Container = Pick<MedusaContainer, "resolve">

export interface CustomerNoteView {
  body: string
  updated_at: string | null
  updated_by: string | null
}

export interface SaveCustomerNoteInput {
  customer_id: string
  /** Trimmed; empty removes the note. */
  body: string
  actor_id: string
}

const notesOf = (container: Container) =>
  container.resolve<OrderNotesModuleService>(ORDER_NOTES_MODULE)

async function assertCustomer(container: Container, customerId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id"],
    filters: { id: customerId },
  })
  if (data.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "customers.unknown")
  }
}

/** The customer's note as the panel shows it; an empty one when none was written. */
export async function customerNote(
  container: Container,
  customerId: string
): Promise<CustomerNoteView> {
  await assertCustomer(container, customerId)
  const [note] = await notesOf(container).listCustomerNotes(
    { customer_id: customerId },
    { take: 1, select: ["body", "updated_at", "updated_by"] }
  )
  return note
    ? {
        body: note.body,
        updated_at: new Date(note.updated_at).toISOString(),
        updated_by: note.updated_by ?? null,
      }
    : { body: "", updated_at: null, updated_by: null }
}

interface Previous {
  id: string | null
  body: string | null
  updated_by: string | null
}

/**
 * Writes the customer's one note, or removes it when emptied (its text
 * goes, it may name the customer). Undone by putting the note back as it
 * was.
 */
const saveCustomerNoteStep = createStep(
  "customers-save-note",
  async (input: SaveCustomerNoteInput, { container }) => {
    await assertCustomer(container, input.customer_id)
    const service = notesOf(container)
    const [current] = await service.listCustomerNotes(
      { customer_id: input.customer_id },
      { take: 1, select: ["id", "body", "updated_by"] }
    )
    const previous: Previous = {
      id: current?.id ?? null,
      body: current?.body ?? null,
      updated_by: current?.updated_by ?? null,
    }
    if (input.body === "") {
      if (current) {
        await service.updateCustomerNotes({ id: current.id, body: "", updated_by: input.actor_id })
        await service.softDeleteCustomerNotes([current.id])
      }
    } else if (current) {
      await service.updateCustomerNotes({
        id: current.id,
        body: input.body,
        updated_by: input.actor_id,
      })
    } else {
      const created = await service.createCustomerNotes({
        customer_id: input.customer_id,
        body: input.body,
        updated_by: input.actor_id,
      })
      return new StepResponse(undefined, { ...previous, created: created.id })
    }
    return new StepResponse(undefined, { ...previous, created: null as string | null })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service = notesOf(container)
    if (previous.created) {
      await service.deleteCustomerNotes([previous.created])
      return
    }
    if (previous.id && previous.body !== null) {
      await service.restoreCustomerNotes([previous.id])
      await service.updateCustomerNotes({
        id: previous.id,
        body: previous.body,
        updated_by: previous.updated_by,
      })
    }
  }
)

/** The team's note on a customer (2026-11-06): written, changed or removed by staff. */
export const saveCustomerNoteWorkflow = createWorkflow(
  "customers-save-note",
  (input: SaveCustomerNoteInput) => new WorkflowResponse(saveCustomerNoteStep(input))
)
