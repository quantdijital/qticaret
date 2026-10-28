import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { MessageTemplateName } from "../../lib/messaging/templates"
import { deliver } from "./deliver"
import { MESSAGE_LOADERS } from "./loaders"

export interface SendMessageInput {
  template: MessageTemplateName
  /** The order, parcel or customer the message is about. */
  resource_id: string
  /** Sets one send apart from another of the same template and resource (a second reset). */
  key?: string
  /** What only the event knew (a reset link's token): passed to the loader, never stored. */
  extra?: Record<string, string>
}

/** Reads the template's values from its resource and sends it on its channels; nothing to undo. */
export const sendMessageStep = createStep(
  "messaging-send",
  async (input: SendMessageInput, { container }) => {
    const load = MESSAGE_LOADERS[input.template] as (typeof MESSAGE_LOADERS)["order.placed"]
    const loaded = await load(container, input.resource_id, input.extra ?? {})
    if (!loaded) {
      return new StepResponse({})
    }
    return new StepResponse(
      await deliver(container, {
        template: input.template,
        resource: { type: loaded.resourceType, id: input.resource_id },
        recipients: loaded.recipients,
        receiverId: loaded.receiverId,
        vars: loaded.vars,
        ...(input.key ? { key: input.key } : {}),
      })
    )
  }
)

/** A message about a resource to its customer (F9.4, adr/0036). */
export const sendMessageWorkflow = createWorkflow(
  "messaging-send",
  (input: SendMessageInput) => new WorkflowResponse(sendMessageStep(input))
)
