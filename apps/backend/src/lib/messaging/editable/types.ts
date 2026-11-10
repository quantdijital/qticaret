import type { Brand } from "../templates/types"

/**
 * A customer message the shop may reword (adr/0036 Ek 2026-11-10): the
 * texts inside the fixed layout, never its HTML. Each field falls back to
 * the catalog's own text (`texts.ts`) when the shop has written nothing.
 */

/** The fields a shop may write, in the order the panel shows them. */
export const TEXT_FIELDS = ["subject", "preheader", "heading", "intro", "sms"] as const
export type TextField = (typeof TEXT_FIELDS)[number]

/** Fields that go in a header or a title: one line. */
export const SINGLE_LINE_FIELDS: ReadonlySet<TextField> = new Set([
  "subject",
  "preheader",
  "heading",
])

/** The longest each field may be, in characters. */
export const TEXT_LIMITS: Readonly<Record<TextField, number>> = {
  subject: 150,
  preheader: 150,
  heading: 150,
  intro: 2000,
  sms: 600,
}

/** What the shop wrote for a template, by field; a field left out reads the default. */
export type OwnTexts = Partial<Record<TextField, string>>

/** How the panel's list groups the messages (the owner, 2026-10-26: long lists in groups). */
export const MESSAGE_GROUPS = [
  "order",
  "shipping",
  "returns",
  "account",
  "stock",
  "marketing",
] as const
export type MessageGroup = (typeof MESSAGE_GROUPS)[number]

export interface EditSpec<V> {
  group: MessageGroup
  /**
   * Always sent, offered with no switch: the law asks for it, or the
   * customer asked for it and nothing else gives it (adr/0036 Ek 2026-11-10).
   */
  required: boolean
  /**
   * Turned on and off with its feature elsewhere, not here: the cart
   * reminder with Pazarlama's own switch (`marketing.abandoned_cart_enabled`).
   */
  switchedIn?: "marketing"
  /** The `{belirteç}`s the shop may write, each with the catalog value it stands for. */
  tokens: Readonly<Record<string, string>>
  /** Each field's catalog key, by the values where the message reads two ways. */
  fields: Partial<Record<TextField, string | ((vars: V) => string)>>
  /** Every catalog value the fields are filled from, as plain text. */
  values: (vars: V, brand: Brand) => Readonly<Record<string, string>>
}
