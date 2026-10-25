import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A feature flag (adr/0012): tenant flags the shop turns on and off, platform flags come with the plan. */
export interface FeatureState {
  key: string
  default: boolean
  owner: "tenant" | "platform"
  enabled: boolean
}

const FEATURES_KEY = ["settings", "features"] as const

export const featuresQuery = () =>
  queryOptions({
    queryKey: FEATURES_KEY,
    queryFn: async () =>
      (await sdk.client.fetch<{ features: FeatureState[] }>("/admin/features")).features,
  })

export function useSetFeature() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      sdk.client.fetch<{ feature: FeatureState }>(`/admin/features/${encodeURIComponent(key)}`, {
        method: "POST",
        body: { enabled },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: FEATURES_KEY })
    },
  })
}
