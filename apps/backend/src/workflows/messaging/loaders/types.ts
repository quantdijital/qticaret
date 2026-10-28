import type { MessageChannel } from "../../../lib/messaging/recipients"

/** Where a message may go: the order's e-mail and phone, a customer's. */
export type MessageRecipients = Partial<Record<MessageChannel, string | null>>

/** A template's values as read from its resource, and its recipients. */
export interface Loaded<V> {
  vars: V
  recipients: MessageRecipients
  receiverId: string | null
  resourceType: string
}

/** The first value with text in it, trimmed; null when none has any. */
export function firstText(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const text = value?.trim() ?? ""
    if (text !== "") {
      return text
    }
  }
  return null
}

/** How a message greets a shopper whose first name it does not have. */
export const GREETING = "Değerli müşterimiz"
