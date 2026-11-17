import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * The AI core's reads (adr/0071 §11), as the backend answers them
 * (`api/admin/ai/services`, `api/admin/ai/usage`). No key, nor any part
 * of one, ever comes back: a service's account is only its state.
 */

export type AiCapability = "text" | "vision" | "image_edit" | "image_generate" | "video"
export type AiServiceStatus =
  "connected" | "unverified" | "rejected" | "unreadable" | "not_connected"

export interface AiServiceView {
  id: string
  capabilities: AiCapability[]
  status: AiServiceStatus
  funding: "own_key" | "platform_credit"
  /** A panel i18n key: where the data goes and whether it trains models. */
  data_note_key: string
}

export interface AiTaskView {
  id: string
  capability: AiCapability
  mode: "sync" | "job"
  options: readonly string[]
  allowed: boolean
  usable: string[]
  preference: string | null
}

export interface AiServicesAnswer {
  services: AiServiceView[]
  tasks: AiTaskView[]
  /** `own_keys` false: the package leaves the shop's own key out; stored keys are kept, unused. */
  flags: { own_keys: boolean }
}

export interface AiUsageLine {
  id: string
  count: number
  succeeded: number
  refused: number
  failed: number
  /** Millionths of the currency, by currency; an estimate, never an invoice. */
  estimated_cost_micros: Record<string, number>
}

export interface AiCeiling {
  used: number
  /** Null: no ceiling. */
  limit: number | null
}

export interface AiUsageAnswer {
  month: string
  services: AiUsageLine[]
  tasks: AiUsageLine[]
  monthly: AiCeiling
  daily: Record<"text" | "image" | "video", AiCeiling>
}

/** Every AI read lives under this key: an account saved, checked or removed refreshes them. */
export const AI_KEY = ["ai"] as const

export const aiServicesQuery = () =>
  queryOptions({
    queryKey: [...AI_KEY, "services"],
    queryFn: () => sdk.client.fetch<AiServicesAnswer>("/admin/ai/services"),
  })

export const aiUsageQuery = () =>
  queryOptions({
    queryKey: [...AI_KEY, "usage"],
    queryFn: () => sdk.client.fetch<AiUsageAnswer>("/admin/ai/usage"),
  })
