import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { AiCreditOrderStatus } from "@qticaret/types/control-plane"
import type { z } from "zod"
import type { StaffRole } from "@/features/auth/api"
import { api } from "@/lib/api"
import type { RequestOptions } from "@/lib/api"
import {
  ordersSchema,
  providersSchema,
  settingsSchema,
  walletSchema,
} from "@/features/ai-credits/api/schemas"

/**
 * What this panel reads of the AI credits (adr/0085 §5). Every route is
 * the owner's alone (apps/control-plane `lib/staff/route-table-ai.ts`):
 * the screens and the menu items are not offered to another role, and the
 * API decides again.
 */
export const canManageAiCredits = (role: StaffRole | null | undefined) => role === "owner"

/** One call whose answer is checked against `schema` (a mismatch is the generic failure). */
export async function read<S extends z.ZodType>(
  schema: S,
  path: string,
  options?: RequestOptions
): Promise<z.infer<S>> {
  return schema.parse(await api<unknown>(path, options))
}

export const AI_CREDITS_KEY = ["ai-credits"] as const
export const walletKey = (tenantId: string) => [...AI_CREDITS_KEY, "wallet", tenantId] as const
export const ORDERS_KEY = [...AI_CREDITS_KEY, "orders"] as const
export const SETTINGS_KEY = [...AI_CREDITS_KEY, "settings"] as const
export const PROVIDERS_KEY = [...AI_CREDITS_KEY, "providers"] as const

export const LEDGER_PAGE_SIZE = 20
export const ORDERS_PAGE_SIZE = 50

export const walletPath = (tenantId: string, rest = "") =>
  `/admin/cp/tenants/${encodeURIComponent(tenantId)}/ai-credits${rest}`

/** A shop's wallet and one page (zero-based) of its ledger, newest first. */
export const walletQuery = (tenantId: string, page: number) =>
  queryOptions({
    queryKey: [...walletKey(tenantId), page],
    queryFn: () =>
      read(walletSchema, walletPath(tenantId), {
        query: { limit: LEDGER_PAGE_SIZE, offset: page * LEDGER_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  })

/** Every shop's top-up requests in one status, a page (zero-based) at a time. */
export const ordersQuery = (status: AiCreditOrderStatus, page: number) =>
  queryOptions({
    queryKey: [...ORDERS_KEY, status, page],
    queryFn: () =>
      read(ordersSchema, "/admin/cp/ai/orders", {
        query: { status, limit: ORDERS_PAGE_SIZE, offset: page * ORDERS_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  })

/**
 * The shops' names for the requests list: the request names its shop by
 * id only, so the first 100 shops (the list route's page) are read once.
 * A shop beyond them is shown by its id.
 */
export const shopNamesQuery = () =>
  queryOptions({
    queryKey: [...AI_CREDITS_KEY, "shop-names"],
    queryFn: async () => {
      const list = await api<{ tenants: { id: string; name: string }[] }>("/admin/cp/tenants", {
        query: { limit: 100 },
      })
      return new Map(list.tenants.map((shop) => [shop.id, shop.name]))
    },
    staleTime: 60_000,
  })

export const settingsQuery = () =>
  queryOptions({
    queryKey: SETTINGS_KEY,
    queryFn: () => read(settingsSchema, "/admin/cp/ai/settings"),
  })

export const providersQuery = () =>
  queryOptions({
    queryKey: PROVIDERS_KEY,
    queryFn: () => read(providersSchema, "/admin/cp/ai/providers"),
  })
