import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** What a key may reach (F11.6, adr/0039 §6); every other admin route is closed to it. */
export const API_SCOPES = ["orders:read", "catalog:read", "stock:write", "webhooks:manage"] as const
export type ApiScope = (typeof API_SCOPES)[number]

/** A scope's text key: i18next reads `:` as a namespace, so `orders:read` is `orders_read`. */
export const scopeKey = (scope: ApiScope) => scope.replace(":", "_")

export interface ApiKeyRow {
  id: string
  title: string
  /** `sk_abc***xyz`: the key itself is shown once, when it is made. */
  redacted: string
  created_at: string
  revoked_at: string | null
  scopes: ApiScope[]
}

const KEY = ["api-access"] as const

/** `GET /admin/api-access`: the shop's API keys, masked, with their scopes. */
export const apiAccessQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: () => sdk.client.fetch<{ keys: ApiKeyRow[] }>("/admin/api-access"),
  })

export function useCreateApiKey() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; scopes: ApiScope[] }) =>
      sdk.client.fetch<{ key: ApiKeyRow; token: string }>("/admin/api-access", {
        method: "POST",
        body,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRevokeApiKey() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ key: ApiKeyRow }>(`/admin/api-access/${encodeURIComponent(id)}/revoke`, {
        method: "POST",
        body: {},
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

/** The OpenAPI document of what keys can reach, saved as a file. */
export async function downloadOpenApi(): Promise<void> {
  const document = await sdk.client.fetch<unknown>("/admin/openapi.json")
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(document, null, 2)], { type: "application/json" })
  )
  const link = Object.assign(window.document.createElement("a"), {
    href: url,
    download: "openapi.json",
  })
  link.click()
  URL.revokeObjectURL(url)
}
