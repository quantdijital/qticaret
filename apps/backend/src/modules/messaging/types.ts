import type { MessageChannel } from "../../lib/messaging/recipients"

export interface MessagingModuleOptions {
  /** 64 hex characters (PII_HASH_KEY): addresses are kept only as this keyed hash. */
  hashKey: string
  /** 64 hex characters (PII_ENCRYPTION_KEY): a consent's address, encrypted for İYS (F10 M11). */
  encryptionKey: string
}

export type ConsentChannel = MessageChannel | "call"
export type ConsentStatus = "granted" | "revoked"
export type ConsentSource = "checkout" | "account" | "panel" | "import" | "iys" | "unsubscribe"

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
}

export interface SuppressionInput {
  channel: MessageChannel
  address: string
  reason: "bounce" | "complaint" | "manual"
  source: "resend" | "netgsm" | "panel"
  detail?: string | null
  created_by?: string | null
}
