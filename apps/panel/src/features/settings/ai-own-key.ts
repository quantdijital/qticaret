import type { AiServiceView } from "@/features/ai/api/ai"

/**
 * Whether a text service is connected with the shop's own key: the only
 * kind a shopper's search runs on (adr/0077 §7; backend `usableServices`
 * under the shop's `own_keys`).
 */
export const hasOwnTextKey = (services: readonly AiServiceView[], ownKeys: boolean): boolean =>
  ownKeys &&
  services.some(
    (service) =>
      service.funding === "own_key" &&
      service.status === "connected" &&
      service.capabilities.includes("text")
  )
