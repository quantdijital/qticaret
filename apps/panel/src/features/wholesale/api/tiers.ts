import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import { WHOLESALE_KEY, useWholesaleMutation as useTierMutation } from "./accounts"
import type { LinesPage, ListOwner, PricesBody, TierBody, TiersPage, WholesaleTier } from "./types"

/** Wholesale levels and the price lines of a level or a wholesaler (ADR-0068 §4). */

export const TIERS_PAGE_SIZE = 50
export const LINES_PAGE_SIZE = 25
/** The most changes `/prices` takes in one request. */
export const PRICES_BATCH = 100
// A shop has a handful of levels: the pickers read them in one go
const ALL_TIERS = 100

const TIERS = "/admin/wholesale/tiers"
const tierAt = (id: string) => `${TIERS}/${encodeURIComponent(id)}`
const ownerAt = (owner: ListOwner) =>
  owner.kind === "tier"
    ? tierAt(owner.id)
    : `/admin/wholesale/accounts/${encodeURIComponent(owner.id)}`

export const tiersQuery = (page = 0) =>
  queryOptions({
    queryKey: [...WHOLESALE_KEY, "tiers", page],
    queryFn: () =>
      sdk.client.fetch<TiersPage>(TIERS, {
        query: { limit: TIERS_PAGE_SIZE, offset: page * TIERS_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  })

/** Every level by name, for the level pickers. */
export const tierOptionsQuery = () =>
  queryOptions({
    queryKey: [...WHOLESALE_KEY, "tiers", "options"],
    queryFn: async () =>
      (await sdk.client.fetch<TiersPage>(TIERS, { query: { limit: ALL_TIERS } })).tiers,
  })

export const tierQuery = (id: string) =>
  queryOptions({
    queryKey: [...WHOLESALE_KEY, "tier", id],
    queryFn: async () => (await sdk.client.fetch<{ tier: WholesaleTier }>(tierAt(id))).tier,
  })

export interface LinesParams {
  q: string
  page: number
}

/** A page of a list's prices, by product name; `q` finds by product, variant or SKU. */
export const linesQuery = (owner: ListOwner, { q, page }: LinesParams) =>
  queryOptions({
    queryKey: [...WHOLESALE_KEY, "lines", owner.kind, owner.id, { q, page }],
    queryFn: () =>
      sdk.client.fetch<LinesPage>(`${ownerAt(owner)}/lines`, {
        query: { limit: LINES_PAGE_SIZE, offset: page * LINES_PAGE_SIZE, ...(q ? { q } : {}) },
      }),
    placeholderData: keepPreviousData,
  })

export const useCreateTier = () =>
  useTierMutation((body: TierBody) =>
    sdk.client.fetch<{ tier: WholesaleTier }>(TIERS, { method: "POST", body })
  )

export const useUpdateTier = (id: string) =>
  useTierMutation((body: Partial<TierBody>) =>
    sdk.client.fetch<{ tier: WholesaleTier }>(tierAt(id), { method: "POST", body })
  )

/** Refused (409 `wholesale.tier_in_use`) while a wholesaler is on it. */
export const useDeleteTier = (id: string) =>
  useTierMutation(() => sdk.client.fetch<{ id: string }>(tierAt(id), { method: "DELETE" }))

/** Prices typed by hand (KDV excluded) set or taken away; the rate prices the rest. */
export const useSetPrices = (owner: ListOwner) =>
  useTierMutation((body: PricesBody) =>
    sdk.client.fetch<{ written: number; removed: number }>(`${ownerAt(owner)}/prices`, {
      method: "POST",
      body,
    })
  )
