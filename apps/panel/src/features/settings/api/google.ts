import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The shop's Google account and its Merchant Center (F10 M13). */
export interface GoogleStatus {
  /** Whether the platform's Google client is set up at all. */
  configured: boolean
  connected: boolean
  email: string | null
  merchant_id: string | null
  /** F10.11: whether the shop allowed Search Console, and its property. */
  search_console: { granted: boolean; site: string | null }
  last_sync: {
    at: string
    sent: number
    removed: number
    failed: number
    error: string | null
  } | null
}

export const googleQuery = () =>
  queryOptions({
    queryKey: ["google"],
    queryFn: () => sdk.client.fetch<{ google: GoogleStatus }>("/admin/google"),
  })

/** Google's consent screen to send the staff member to. */
export const startGoogleConnect = () =>
  sdk.client.fetch<{ url: string }>("/admin/google/connect", { method: "POST" })

export function useGoogleAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (
      action: { kind: "merchant"; merchantId: string } | { kind: "sync" } | { kind: "disconnect" }
    ) =>
      action.kind === "merchant"
        ? sdk.client.fetch("/admin/google/merchant", {
            method: "POST",
            body: { merchant_id: action.merchantId },
          })
        : action.kind === "sync"
          ? sdk.client.fetch("/admin/google/merchant/sync", { method: "POST" })
          : sdk.client.fetch("/admin/google", { method: "DELETE" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["google"] })
    },
  })
}

/** The Search Console properties the connected account can read. */
export const searchConsoleSitesQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["google", "search-console", "sites"],
    queryFn: () =>
      sdk.client.fetch<{ sites: { site_url: string; permission: string }[] }>(
        "/admin/google/search-console/sites"
      ),
    enabled,
  })

export function useSaveSearchConsoleSite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (site: string) =>
      sdk.client.fetch("/admin/google/search-console", { method: "POST", body: { site } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["google"] })
    },
  })
}
