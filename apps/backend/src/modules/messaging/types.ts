import type { MessageChannel } from "../../lib/messaging/recipients"
import type { MessageSkipReason } from "./models/message-skip"

export interface MessagingModuleOptions {
  /** 64 hex characters (PII_HASH_KEY): addresses are kept only as this keyed hash. */
  hashKey: string
  /** 64 hex characters (PII_ENCRYPTION_KEY): a consent's address, encrypted for İYS (F10 M11). */
  encryptionKey: string
}

export type ConsentChannel = MessageChannel | "call"
export type ConsentStatus = "granted" | "revoked"
export type ConsentSource =
  "checkout" | "account" | "panel" | "import" | "iys" | "unsubscribe" | "newsletter"

/** How a consent was given or withdrawn; never an address (adr/0038 §2). */
export type ConsentEvidence = Record<string, string>

export interface ConsentInput {
  channel: ConsentChannel
  address: string
  status: ConsentStatus
  source: ConsentSource
  customer_id?: string | null
  /** The staff member, when the panel changed it. */
  changed_by?: string | null
  evidence?: ConsentEvidence | null
  /** When it was given, for one recorded elsewhere first (a migration, F14); else now. */
  given_at?: Date | null
  /** Only for an address without an answer yet: an old record never overrides a newer one. */
  only_new?: boolean
}

export interface SuppressionInput {
  channel: MessageChannel
  address: string
  reason: "bounce" | "complaint" | "manual"
  source: "resend" | "netgsm" | "panel" | "smtp"
  detail?: string | null
  created_by?: string | null
}

/** A message not sent and why (F12.8); the address arrives masked, if at all. */
export interface SkipInput {
  send_key: string
  template: string
  channel: MessageChannel
  reason: MessageSkipReason
  resource_type: string
  resource_id: string
  receiver_id: string | null
  recipient_masked: string | null
}

/** A customer message as the shop worded it (adr/0036 Ek 2026-11-10); null fields read the default. */
export interface TemplateTextValues {
  enabled: boolean
  subject: string | null
  preheader: string | null
  heading: string | null
  intro: string | null
  sms: string | null
}

export interface TemplateTextRow extends TemplateTextValues {
  template: string
  updated_by: string | null
}
