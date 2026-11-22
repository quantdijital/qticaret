import { emitEventStep } from "@medusajs/medusa/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { CONTACT_MESSAGES_MODULE } from "../../modules/contact-messages"
import type ContactMessagesModuleService from "../../modules/contact-messages/service"
import type { ReceiveInput } from "../../modules/contact-messages/service"

/** Raised once a contact message is kept; the bell and the staff e-mail follow it. */
export const CONTACT_MESSAGE_RECEIVED = "contact_message.received"

/** Keeps a message sealed; undone by deleting it. Also a booking request's (booking-request.ts). */
export const receiveContactMessageStep = createStep(
  "contact-receive-message",
  async (input: ReceiveInput, { container }) => {
    const created = await container
      .resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
      .receive(input)
    return new StepResponse(created, created.id)
  },
  async (id, { container }) => {
    if (id) {
      await container
        .resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
        .deleteContactMessages([id])
    }
  }
)

/** F18 D10 (adr/0047): a message from the storefront's contact form, kept sealed. */
export const receiveContactMessageWorkflow = createWorkflow(
  "contact-receive-message",
  (input: ReceiveInput) => {
    const created = receiveContactMessageStep(input)
    emitEventStep({
      eventName: CONTACT_MESSAGE_RECEIVED,
      data: transform({ created }, ({ created }) => ({ id: created.id })),
    })
    return new WorkflowResponse(created)
  }
)

export interface MarkContactMessageInput {
  id: string
  status: "new" | "handled"
  by: string
}

const markStep = createStep(
  "contact-mark-message",
  async (input: MarkContactMessageInput, { container }) => {
    const messages = container.resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
    const [message] = await messages.listContactMessages(
      { id: input.id },
      { select: ["id", "status", "handled_by", "handled_at"], take: 1 }
    )
    if (!message) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "contact_messages.unknown")
    }
    const handled = input.status === "handled"
    await messages.updateContactMessages({
      id: input.id,
      status: input.status,
      handled_by: handled ? input.by : null,
      handled_at: handled ? new Date() : null,
    })
    return new StepResponse({ id: input.id }, message)
  },
  async (previous, { container }) => {
    if (previous) {
      await container
        .resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
        .updateContactMessages({
          id: previous.id,
          status: previous.status,
          handled_by: previous.handled_by,
          handled_at: previous.handled_at,
        })
    }
  }
)

/** Staff marking a message answered, or back to waiting. */
export const markContactMessageWorkflow = createWorkflow(
  "contact-mark-message",
  (input: MarkContactMessageInput) => new WorkflowResponse(markStep(input))
)

// The workflow's only step: nothing after it can fail and ask for the message back
const deleteStep = createStep(
  "contact-delete-message",
  async (input: { id: string }, { container }) => {
    const messages = container.resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
    const [message] = await messages.listContactMessages(
      { id: input.id },
      { select: ["id"], take: 1 }
    )
    if (!message) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "contact_messages.unknown")
    }
    await messages.deleteContactMessages([input.id])
    return new StepResponse({ id: input.id })
  }
)

/**
 * Staff removing a message (spam, or done with): deleted for good, not
 * hidden, so nothing of the person outlives it (adr/0047).
 */
export const deleteContactMessageWorkflow = createWorkflow(
  "contact-delete-message",
  (input: { id: string }) => new WorkflowResponse(deleteStep(input))
)
