import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { MessagePreview } from "./messaging"

/** What the shop may write in a customer message (adr/0036 Ek 2026-11-10), in the panel's order. */
export const TEXT_FIELDS = ["subject", "preheader", "heading", "intro", "sms"] as const
export type TextField = (typeof TEXT_FIELDS)[number]

export const MESSAGE_GROUPS = [
  "order",
  "shipping",
  "returns",
  "account",
  "stock",
  "marketing",
] as const
export type MessageGroup = (typeof MESSAGE_GROUPS)[number]

/** One customer message as the backend lists it. */
export interface CustomerMessage {
  name: string
  kind: "transactional" | "commercial"
  channels: ("email" | "sms")[]
  group: MessageGroup
  /** Turned on and off here, never (required), or with Pazarlama's cart reminders. */
  switch: "here" | "required" | "marketing"
  enabled: boolean
  /**
   * The `{belirteç}`s it offers: what each says in the preview and at its
   * longest (the SMS is counted with it), whether a send may leave it
   * empty, whether a person typed it (a letter outside the Turkish table
   * sends the SMS as UCS-2).
   */
  tokens: {
    name: string
    sample: string
    longest: string
    may_be_empty: boolean
    free_text: boolean
  }[]
  /** The platform's text, the shop's own (null: the platform's is used), the tokens it must keep. */
  fields: { field: TextField; default: string; text: string | null; required_tokens: string[] }[]
}

/** A save: a field left out keeps its value, null brings the platform's back. */
export type CustomerMessageInput = { enabled?: boolean } & Partial<Record<TextField, string | null>>

const LIST = "/admin/messaging/customer-messages"
const KEY = ["messaging", "customer-messages"] as const

/** Every customer message, grouped by the backend, with the shop's words beside the platform's. */
export const customerMessagesQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: () => sdk.client.fetch<{ messages: CustomerMessage[] }>(LIST),
  })

/** Saves a message's words and switch; the list and its previews are read again. */
export function useSaveCustomerMessage(name: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: CustomerMessageInput) =>
      sdk.client.fetch<{ customer_message: CustomerMessage }>(
        `${LIST}/${encodeURIComponent(name)}`,
        { method: "POST", body }
      ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: KEY }),
        client.invalidateQueries({ queryKey: ["messaging", "templates", name] }),
      ])
    },
  })
}

/**
 * The message as it would read with these words, saved or not; nothing is
 * kept. Checked as a save checks it: an unknown `{belirteç}` is refused.
 */
export const draftPreviewQuery = (name: string, body: CustomerMessageInput, enabled: boolean) =>
  queryOptions({
    queryKey: ["messaging", "templates", name, "draft", body],
    queryFn: () =>
      sdk.client.fetch<MessagePreview>(
        `/admin/messaging/templates/${encodeURIComponent(name)}/preview`,
        { method: "POST", body }
      ),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  })
