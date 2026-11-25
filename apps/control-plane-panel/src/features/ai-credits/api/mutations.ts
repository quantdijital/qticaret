import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"
import type { AiTargetCapability, PaymentMethod } from "@qticaret/types/control-plane"
import { withStepUp } from "@/lib/step-up"
import {
  ORDERS_KEY,
  PROVIDERS_KEY,
  SETTINGS_KEY,
  read,
  settingsQuery,
  walletKey,
  walletPath,
} from "@/features/ai-credits/api/queries"
import {
  adjustAnswerSchema,
  checkSchema,
  dailyCapAnswerSchema,
  orderAnswerSchema,
  paidAnswerSchema,
  providerAnswerSchema,
  settingsSchema,
} from "@/features/ai-credits/api/schemas"
import type { AiOrder, AiSettings } from "@/features/ai-credits/api/schemas"

/**
 * The owner's changes to the AI credits (adr/0085 §5): each behind a
 * step-up (`withStepUp`, the route table's `stepUp: true`) except
 * "Bağlantıyı dene", which writes nothing. Each reads again what it moved.
 */

const post = (body: unknown, headers: Record<string, string>) => ({
  method: "POST" as const,
  body,
  headers,
})

function useChange<I, O>(call: (input: I) => Promise<O>, keys: (input: I) => QueryKey[]) {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: call,
    onSettled: async (_data, _error, input) => {
      await Promise.all(keys(input).map((queryKey) => client.invalidateQueries({ queryKey })))
    },
  })
}

export interface AdjustInput {
  amount: number
  bucket: "plan" | "purchased"
  note: string
  /** The form's one key (`adjust:<uuid>` on the server): sent again, nothing changes twice. */
  key: string
}

/** "Kredi ekle / düş": `applied: false` when the same key was already written. */
export const useAdjust = (tenantId: string) =>
  useChange(
    (input: AdjustInput) =>
      withStepUp((headers) =>
        read(adjustAnswerSchema, walletPath(tenantId, "/adjust"), post(input, headers))
      ),
    () => [walletKey(tenantId)]
  )

/** The shop's own day's cap; null: the platform's. */
export const useSetDailyCap = (tenantId: string) =>
  useChange(
    (daily_cap: number | null) =>
      withStepUp((headers) =>
        read(dailyCapAnswerSchema, walletPath(tenantId, "/daily-cap"), post({ daily_cap }, headers))
      ),
    () => [walletKey(tenantId)]
  )

const orderPath = (order: AiOrder, action: "paid" | "cancel") =>
  `/admin/cp/ai/orders/${encodeURIComponent(order.id)}/${action}`

/** "Ödendi": the pack's credits added once; the list and the shop's wallet read again. */
export const useMarkPaid = (order: AiOrder) =>
  useChange(
    (input: { method: PaymentMethod; reference: string }) =>
      withStepUp((headers) =>
        read(
          paidAnswerSchema,
          orderPath(order, "paid"),
          post({ method: input.method, reference: input.reference.trim() || null }, headers)
        )
      ),
    () => [ORDERS_KEY, walletKey(order.tenant_id)]
  )

/** "İptal et": the server takes no note (its body is empty). */
export const useCancelOrder = (order: AiOrder) =>
  useChange(
    () =>
      withStepUp((headers) =>
        read(orderAnswerSchema, orderPath(order, "cancel"), post({}, headers))
      ),
    () => [ORDERS_KEY, walletKey(order.tenant_id)]
  )

const providerPath = (service: string, rest = "") =>
  `/admin/cp/ai/providers/${encodeURIComponent(service)}${rest}`

/** A new version of the service's key; the key goes out once and is never read back. */
export const useWriteKey = (service: string) =>
  useChange(
    (apiKey: string) =>
      withStepUp((headers) =>
        read(providerAnswerSchema, providerPath(service), post({ api_key: apiKey }, headers))
      ),
    () => [PROVIDERS_KEY, SETTINGS_KEY]
  )

/** The key gone (every version), its routings first. */
export const useDeleteKey = (service: string) =>
  useChange(
    () =>
      withStepUp((headers) =>
        read(providerAnswerSchema, providerPath(service), { method: "DELETE", headers })
      ),
    () => [PROVIDERS_KEY, SETTINGS_KEY]
  )

/** "Bağlantıyı dene": no step-up, nothing written but the audit row. */
export const useCheckKey = (service: string) =>
  useMutation({
    gcTime: 0,
    mutationFn: () => read(checkSchema, providerPath(service, "/test"), post({}, {})),
  })

export interface PackInput {
  id?: string
  name: string
  credits: number
  amount: number
  active: boolean
}

export interface SettingsBody {
  daily_cap?: number
  purchased_lifetime_months?: number
  packs?: PackInput[]
  routing?: Partial<Record<AiTargetCapability, { service: string; model: string } | null>>
}

/** The packs as the settings route takes them back: the kept ones by id, no currency. */
export const packsBody = (packs: AiSettings["packs"]): PackInput[] =>
  packs.map(({ id, name, credits, amount, active }) => ({ id, name, credits, amount, active }))

/**
 * A settings change made on the settings as they are now: read again
 * first (no optimistic lock on the server; the last write wins, PR #374
 * B3), so a pack another owner just added is not dropped.
 */
export function useSaveSettings() {
  const client = useQueryClient()
  return useChange(
    async (change: (current: AiSettings) => SettingsBody) => {
      const fresh = await client.query({ ...settingsQuery(), staleTime: 0 })
      const body = change(fresh.settings)
      return await withStepUp((headers) =>
        read(settingsSchema, "/admin/cp/ai/settings", post(body, headers))
      )
    },
    () => [SETTINGS_KEY, PROVIDERS_KEY]
  )
}
