import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AppearanceSettings } from "@qticaret/types"
import { sdk } from "@/lib/sdk"

const URL = "/admin/platform-settings/appearance"
export const APPEARANCE_KEY = ["settings", "appearance"] as const

export interface AppearanceResponse {
  values: AppearanceSettings
  version: number
}

export const appearanceQuery = () =>
  queryOptions({
    queryKey: APPEARANCE_KEY,
    queryFn: () => sdk.client.fetch<AppearanceResponse>(URL),
    staleTime: 5 * 60_000,
  })

/** Saves the fields sent; the stored values replace the cache at once. */
export function useSaveAppearance() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (values: Partial<AppearanceSettings>) =>
      sdk.client.fetch<AppearanceResponse>(URL, { method: "POST", body: values }),
    onSuccess: (saved) => {
      client.setQueryData(APPEARANCE_KEY, saved)
    },
  })
}
