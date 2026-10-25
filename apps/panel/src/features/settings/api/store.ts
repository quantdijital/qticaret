import { queryOptions, useQuery } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export const storeQuery = () =>
  queryOptions({
    queryKey: ["settings", "store"],
    queryFn: async () => (await sdk.admin.store.list({ fields: "id,name" })).stores[0] ?? null,
    staleTime: 5 * 60_000,
  })

/** The shop's name for the sidebar; undefined until it loads. */
export function useStoreName(): string | undefined {
  const { data } = useQuery(storeQuery())
  const name = data?.name.trim()
  return name === undefined || name === "" ? undefined : name
}
