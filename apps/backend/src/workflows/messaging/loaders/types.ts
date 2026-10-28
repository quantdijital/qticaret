import { readsAsLink } from "../../../lib/text/link-like"
import type { MessageChannel } from "../../../lib/messaging/recipients"

/** Where a message may go: the order's e-mail and phone, a customer's. */
export type MessageRecipients = Partial<Record<MessageChannel, string | null>>

/** A template's values as read from its resource, and its recipients. */
export interface Loaded<V> {
  vars: V
  recipients: MessageRecipients
  receiverId: string | null
  resourceType: string
  /** Channels this message may not use (a checkout's texts held, F10 M9). */
  held?: MessageChannel[]
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

// A shopper types their name and address at checkout, and an order's e-mail
// may be anyone's: what reads as a link or an address is not repeated in a
// message the shop sends, so nobody can write one to a stranger in its name
/** A name as a message may greet with it: short, and nothing that reads as a link. */
export function personName(value: string | null | undefined): string | null {
  const name = firstText(value)
  return name && name.length <= 40 && !readsAsLink(name) && !/\d/.test(name) ? name : null
}

/** An address line as a message repeats it; null when it reads as a link. */
export function addressLine(value: string): string | null {
  const line = value.trim().slice(0, 120)
  return line === "" || /:\/\/|www\.|@/i.test(line) ? null : line
}

/** How a message greets a shopper whose first name it does not have. */
export const GREETING = "Değerli müşterimiz"
