import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A PTT barcode range as Settings > Shipping > PTT Kargo lists it (docs/entegrasyonlar/ptt.md). */
export interface PttRange {
  id: string
  /** Its first and last twelve-digit numbers. */
  first: string
  last: string
  size: number
  used: number
  remaining: number
  created_at: string
}

export interface PttRanges {
  ranges: PttRange[]
  remaining: number
  total: number
  /** Few enough left to ask PTT for a new range (the server decides: < 10 % or < 50). */
  low: boolean
}

const KEY = ["settings", "ptt-barcodes"] as const
const url = "/admin/shipping-setup/ptt-barcodes"

export const pttRangesQuery = () =>
  queryOptions({ queryKey: KEY, queryFn: () => sdk.client.fetch<PttRanges>(url) })

function useRangeMutation<T>(run: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export const useAddPttRange = () =>
  useRangeMutation((body: { first: string; last: string }) =>
    sdk.client.fetch<{ id: string }>(url, { method: "POST", body })
  )

export const useRemovePttRange = () =>
  useRangeMutation((id: string) =>
    sdk.client.fetch(`${url}/${encodeURIComponent(id)}`, { method: "DELETE" })
  )
