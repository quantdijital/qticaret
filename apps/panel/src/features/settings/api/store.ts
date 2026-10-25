import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

// Medusa's own store record (name, currencies); our extra fields are the "store" settings section
const STORE_KEY = ["settings", "medusa-store"] as const

export const storeQuery = () =>
  queryOptions({
    queryKey: STORE_KEY,
    queryFn: async () => (await sdk.admin.store.list({ fields: "id,name" })).stores[0] ?? null,
    staleTime: 5 * 60_000,
  })

/** The shop's name for the sidebar; undefined until it loads. */
export function useStoreName(): string | undefined {
  const { data } = useQuery(storeQuery())
  const name = data?.name.trim()
  return name === undefined || name === "" ? undefined : name
}

export function useRenameStore() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      sdk.admin.store.update(id, { name }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: STORE_KEY })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
