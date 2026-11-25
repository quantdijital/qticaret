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
  /** The backgrounds its image editing makes (`image_background` options); empty without one. */
  backgrounds?: string[]
  /** It can set a product photo in a scene (`image_scene`). */
  scene?: boolean
}

/** A scene as the picker shows it (the shop's own first, then its pack's); never its prompt. */
export interface AiSceneView {
  code: string
  name: { tr: string; en: string }
  /** The shop saved it (Settings > Yapay zekâ). */
  own?: boolean
}

export interface AiTaskView {
  id: string
  capability: AiCapability
  mode: "sync" | "job"
  options: readonly string[]
  allowed: boolean
  usable: string[]
  preference: string | null
  /** `image_scene`: the shop's scenes, its own (twelve at most) then its pack's (two at most). */
  scenes?: AiSceneView[]
}

export interface AiServicesAnswer {
  services: AiServiceView[]
  tasks: AiTaskView[]
  /** `own_keys` false: the package leaves the shop's own key out; stored keys are kept, unused. */
  flags: { own_keys: boolean }
  /** Connected services the panel assistant runs on (tool calling verified, adr/0079 §8). */
  assistant_services?: string[]
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
  /**
   * The month's calls on the platform's credits and the credits the
   * gateway charged them (adr/0085 §3). Optional: a server of before
   * adr/0085 does not send it.
   */
  platform_credits?: { calls: number; credits: number }
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

/** One task's suggestions of the last days: offered, accepted and the rate (adr/0074 §4). */
export interface AiAcceptanceLine {
  task: string
  offered: number
  accepted: number
  /** Accepted of offered, 0–1; null with none offered. */
  rate: number | null
}

export interface AiAcceptanceAnswer {
  days: number
  tasks: AiAcceptanceLine[]
}

export const aiAcceptanceQuery = () =>
  queryOptions({
    queryKey: [...AI_KEY, "acceptance"],
    queryFn: () => sdk.client.fetch<AiAcceptanceAnswer>("/admin/ai/acceptance"),
  })
