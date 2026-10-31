import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** One entry of the shop's block list (F15.6, adr/0044 §4); an e-mail or a phone shown masked. */
export type FraudBlockKind = "email" | "email_domain" | "phone" | "ip"

export interface FraudBlock {
  id: string
  kind: FraudBlockKind
  display: string
  reason: string | null
  expires_at: string | null
  created_at: string
}

export const FRAUD_BLOCK_KINDS: readonly FraudBlockKind[] = ["email", "email_domain", "phone", "ip"]

const KEY = ["fraud-blocks"] as const

export const fraudBlocksQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: () =>
      sdk.client.fetch<{ blocks: FraudBlock[]; count: number }>("/admin/fraud/blocks", {
        query: { limit: 100 },
      }),
  })

function useBlockMutation<T>(run: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export const useAddBlock = () =>
  useBlockMutation((body: { kind: FraudBlockKind; value: string; reason?: string }) =>
    sdk.client.fetch("/admin/fraud/blocks", { method: "POST", body })
  )

export const useRemoveBlock = () =>
  useBlockMutation((id: string) =>
    sdk.client.fetch(`/admin/fraud/blocks/${encodeURIComponent(id)}`, { method: "DELETE" })
  )
