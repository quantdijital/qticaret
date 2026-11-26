import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import type { MessageState } from "../messaging/history"

type Container = Pick<MedusaContainer, "resolve">

/** The template a note goes to its customer with (Batch 9 / O3). */
export const ORDER_NOTE_TEMPLATE = "order.note" as const

/**
 * The send's key as `deliver` makes it (template, channel, the order, the
 * note): one e-mail per note, and how the note's card finds whether it went.
 */
export const noteSendKey = (orderId: string, noteId: string): string =>
  [ORDER_NOTE_TEMPLATE, "email", orderId, noteId].join(":")

const STATE: Record<string, MessageState> = {
  success: "sent",
  pending: "pending",
  failure: "failed",
}

/**
 * Which of the order's notes went to its customer, and how: sent, waiting,
 * failed, or not sent (skipped, with the reason in the order's history).
 * No migration: Medusa's notification and the skip record carry it, by key.
 */
export async function noteSendStates(
  container: Container,
  orderId: string,
  noteIds: readonly string[]
): Promise<Map<string, MessageState>> {
  const states = new Map<string, MessageState>()
  if (noteIds.length === 0) {
    return states
  }
  const byKey = new Map(noteIds.map((id) => [noteSendKey(orderId, id), id]))
  const keys = [...byKey.keys()]
  const [{ data }, skips] = await Promise.all([
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "notification",
      fields: ["idempotency_key", "status"],
      filters: { idempotency_key: keys },
    }),
    container
      .resolve<MessagingModuleService>(MESSAGING_MODULE)
      .listMessageSkips({ send_key: keys }, { select: ["send_key"] }),
  ])
  for (const skip of skips) {
    const id = byKey.get(skip.send_key)
    if (id) {
      states.set(id, "skipped")
    }
  }
  // A notification is the later word: a skipped send that went out since has one
  for (const row of data as { idempotency_key?: string | null; status?: string | null }[]) {
    const id = byKey.get(row.idempotency_key ?? "")
    if (id) {
      states.set(id, STATE[row.status ?? ""] ?? "pending")
    }
  }
  return states
}
