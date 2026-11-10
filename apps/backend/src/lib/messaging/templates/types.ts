import type { EditSpec, OwnTexts } from "../editable/types"
import type { MessageChannel } from "../recipients"

/**
 * A message template (adr/0036): what it says on each channel, whether it
 * needs the recipient's consent, and sample values for the panel's preview.
 */

/** Transactional messages need no consent; commercial ones need it on the channel. */
export type MessageKind = "transactional" | "commercial"

/** The shop as every message presents it. */
export interface Brand {
  shopName: string
  /** An https logo, or null to show the name. */
  logoUrl: string | null
  /** `#rrggbb`. */
  color: string
  contactEmail: string | null
  contactPhone: string | null
  /** `https://host` of the storefront, or null until a domain is set. */
  storefrontUrl: string | null
}

/** What a send knows of its recipient that the template does not: their way out, the shop's words. */
export interface EmailContext {
  /** The recipient's one-click unsubscribe link; commercial messages only (adr/0038 §1). */
  unsubscribeUrl: string | null
  /** What the shop wrote in place of the catalog's texts (adr/0036 Ek 2026-11-10). */
  own?: OwnTexts | undefined
}

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export interface MessageTemplate<V> {
  /** Medusa's `template` on the notification, and our catalog's prefix. */
  name: string
  kind: MessageKind
  channels: readonly MessageChannel[]
  /**
   * Whether a failed send may be tried again from the stored resource;
   * false when it carries a secret only the event had (a reset link).
   */
  retry: boolean
  email?: (vars: V, brand: Brand, context?: EmailContext) => EmailContent
  /** The text message; `own` is what the shop wrote in its place. */
  sms?: (vars: V, brand: Brand, own?: OwnTexts) => string
  /**
   * A customer message the shop may reword and, unless it is required,
   * turn off (adr/0036 Ek 2026-11-10); none for the team's own alerts and
   * for messages whose body is written per send (a campaign).
   */
  editable?: EditSpec<V>
  /** Values for the panel's preview: made up, never a real customer's. */
  sample: V
}
