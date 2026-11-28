import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { FeePlan } from "@/features/settings/shipping-fee"
import { sdk } from "@/lib/sdk"

const OPTIONS_URL = "/admin/shipping-setup/options"
const SETTINGS_URL = "/admin/platform-settings"

export interface FeeSaveResult {
  /** The old main option orders still need: kept, now among the extras. */
  replacedKept: boolean
}

/**
 * Saves the "Kargo ücreti" answer (settings/shipping-fee.ts) in the order
 * that never leaves the shop without an option: the main option first
 * (made, repriced or kept), then the threshold and the main option's id,
 * then the replaced option goes. Prices stay the server's to work out.
 */
export function useSaveShippingFee() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (plan: FeePlan): Promise<FeeSaveResult> => {
      const step = plan.option
      let id: string
      if (step.kind === "create") {
        id = (
          await sdk.client.fetch<{ id: string }>(OPTIONS_URL, { method: "POST", body: step.body })
        ).id
      } else {
        id = step.id
        if (step.kind === "update") {
          await sdk.client.fetch(`${OPTIONS_URL}/${encodeURIComponent(id)}`, {
            method: "POST",
            body: { amount: step.amount },
          })
        }
      }
      await sdk.client.fetch(`${SETTINGS_URL}/promotions`, {
        method: "POST",
        body: {
          free_shipping_threshold: plan.threshold,
          // With no threshold the condition means nothing and is left as it is
          ...(plan.condition === null ? {} : { free_shipping_condition: plan.condition }),
        },
      })
      await sdk.client.fetch(`${SETTINGS_URL}/shipping`, {
        method: "POST",
        body: { primary_option_id: id },
      })
      if (step.kind !== "create" || step.replaces === null) {
        return { replacedKept: false }
      }
      try {
        await sdk.client.fetch(`${OPTIONS_URL}/${encodeURIComponent(step.replaces)}`, {
          method: "DELETE",
        })
        return { replacedKept: false }
      } catch {
        // Orders still to ship on it (shipping.option_in_use): it stays, as an extra
        return { replacedKept: true }
      }
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["settings", "shipping-options"] }),
        client.invalidateQueries({ queryKey: ["settings", "promotions"] }),
        client.invalidateQueries({ queryKey: ["settings", "shipping"] }),
      ])
    },
  })
}
