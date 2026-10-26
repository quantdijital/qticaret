import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Price lists (F4.1): Medusa's own routes, and the panel's lines and percentage routes. */

const DETAIL_FIELDS = "id,title,description,type,status,starts_at,ends_at,rules"
// The list counts each list's prices
const LIST_FIELDS = `${DETAIL_FIELDS},prices.id`
// A shop's lists and customer groups fit one read
const ALL = 200

export const priceListsQuery = () =>
  queryOptions({
    queryKey: ["price-lists", "list"],
    queryFn: async () =>
      (await sdk.admin.priceList.list({ fields: LIST_FIELDS, limit: ALL, order: "-created_at" }))
        .price_lists,
  })

export type PriceList = Awaited<ReturnType<typeof sdk.admin.priceList.retrieve>>["price_list"]

export const priceListQuery = (id: string) =>
  queryOptions({
    queryKey: ["price-lists", "detail", id],
    queryFn: async () =>
      (await sdk.admin.priceList.retrieve(id, { fields: DETAIL_FIELDS })).price_list,
  })

/** One price of `GET /admin/price-lists/:id/lines`: amounts as exact lira ("28.33"). */
export interface PriceListLine {
  price_id: string
  variant_id: string
  variant_title: string | null
  sku: string | null
  product_id: string
  product_title: string
  thumbnail: string | null
  currency_code: string
  /** The variant's own price; null when it has none in the currency. */
  base: string | null
  price: string
}

export interface PriceListOverlap {
  id: string
  title: string
  type: string
  starts_at: string | null
  ends_at: string | null
  variant_count: number
}

export const priceListLinesQuery = (id: string) =>
  queryOptions({
    queryKey: ["price-lists", "lines", id],
    queryFn: () =>
      sdk.client.fetch<{ lines: PriceListLine[]; overlaps: PriceListOverlap[] }>(
        `/admin/price-lists/${encodeURIComponent(id)}/lines`
      ),
  })

export const customerGroupsQuery = () =>
  queryOptions({
    queryKey: ["customer-groups", "names"],
    queryFn: async () =>
      (await sdk.admin.customerGroup.list({ fields: "id,name", limit: ALL, order: "name" }))
        .customer_groups,
    staleTime: 5 * 60_000,
  })

function usePriceListMutation<T, R>(run: (input: T) => Promise<R>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    // Settled: a half-done change still changed the list
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ["price-lists"] })
    },
  })
}

type CreateBody = Parameters<typeof sdk.admin.priceList.create>[0]

/** A new list, or an existing one's details; returns its id. */
export const useSavePriceList = (id: string | null) =>
  usePriceListMutation(async (body: CreateBody) =>
    id
      ? (await sdk.admin.priceList.update(id, body)).price_list.id
      : (await sdk.admin.priceList.create(body)).price_list.id
  )

/**
 * Only the list is read again: the deleted list's own page is being left,
 * and reading it again would fail and unmount the page before it leaves.
 */
export function useDeletePriceList() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sdk.admin.priceList.delete(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["price-lists", "list"] })
    },
  })
}

/** The list on (active) or off (draft), nothing else changed. */
export const useSetPriceListStatus = (id: string) =>
  usePriceListMutation((status: "active" | "draft") => sdk.admin.priceList.update(id, { status }))

/** A price typed for one variant, or a line taken out. */
export const useSetListPrice = (id: string) =>
  usePriceListMutation(
    (change: { line: PriceListLine; amount: number } | { remove: PriceListLine }) =>
      sdk.admin.priceList.batchPrices(
        id,
        "remove" in change
          ? { delete: [change.remove.price_id] }
          : {
              update: [
                {
                  id: change.line.price_id,
                  variant_id: change.line.variant_id,
                  currency_code: change.line.currency_code,
                  amount: change.amount,
                },
              ],
            }
      )
  )

// The most products the server takes at once
const DISCOUNT_BATCH = 500

/**
 * Products at their own price less a percentage; the server works out the
 * amounts. `onlyListed`: a new rate for the list's own lines only. A long
 * list goes in parts of 500 products.
 */
export const useDiscountListProducts = (id: string) =>
  usePriceListMutation(
    async (input: { productIds: string[]; percent: number; onlyListed: boolean }) => {
      const total = { priced: 0, skipped: [] as string[] }
      for (let start = 0; start < input.productIds.length; start += DISCOUNT_BATCH) {
        const part = await sdk.client.fetch<{ priced: number; skipped: string[] }>(
          `/admin/price-lists/${encodeURIComponent(id)}/discount`,
          {
            method: "POST",
            body: {
              product_ids: input.productIds.slice(start, start + DISCOUNT_BATCH),
              percent: input.percent,
              only_listed: input.onlyListed,
            },
          }
        )
        total.priced += part.priced
        total.skipped.push(...part.skipped)
      }
      return total
    }
  )
