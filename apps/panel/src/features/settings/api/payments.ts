import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * The shop's provider accounts (adr/0027). The server never sends a secret
 * back, nor any part of one: only whether each is stored.
 */
export type AccountState = "not_configured" | "connected" | "unverified" | "rejected" | "unreadable"
export type AccountCheck =
  "valid" | "merchant_invalid" | "secret_invalid" | "unreachable" | "failed" | "not_configured"

/**
 * One provider's account; the settings are the provider's own. Every
 * provider names its test or sandbox switch `test_mode`.
 */
export interface ProviderAccount<Settings = Record<string, unknown>> {
  /** `paytr` today; iyzico joins in V8. */
  provider: string
  state: AccountState
  settings: Settings | null
  /** Whether each secret is stored, by field. */
  secrets: Record<string, boolean>
  secrets_version: number
  verified_at: string | null
  updated_at: string | null
}

export type PaytrAccount = ProviderAccount<{ merchant_id: string; test_mode: boolean }>
export type IyzicoAccount = ProviderAccount<{ test_mode: boolean }>
/** Geliver (F7, adr/0031): one API token; test shipments are a flag, not another account. */
export type GeliverAccount = ProviderAccount<{ test_mode: boolean }>
/** Aras Kargo on the shop's own contract (adr/0035). */
export type ArasAccount = ProviderAccount<{
  test_mode: boolean
  customer_code: string
  service_url: string
}>
/** The shop's Netgsm SMS account and its sender name (adr/0036). */
export type NetgsmAccount = ProviderAccount<{ msgheader: string; iys_brand_code?: string }>
/** Yurtiçi Kargo on the shop's own contract, with its door account when it has one (adr/0035). */
export type YurticiAccount = ProviderAccount<{ test_mode: boolean }>

interface AccountsResponse {
  key_configured: boolean
  accounts: ProviderAccount[]
}

export interface AccountSave {
  settings: Record<string, unknown>
  /** Only the secrets typed in; one left out keeps the stored value. */
  secrets?: Record<string, string>
}

const ACCOUNTS_KEY = ["settings", "provider-accounts"] as const
const accountUrl = (provider: string) =>
  `/admin/integrations/credentials/${encodeURIComponent(provider)}`

export const fetchProviderAccounts = () =>
  sdk.client.fetch<AccountsResponse>("/admin/integrations/credentials")

export const providerAccountsQuery = () =>
  queryOptions({ queryKey: ACCOUNTS_KEY, queryFn: fetchProviderAccounts })

interface AccountAnswer {
  account: ProviderAccount
  check: AccountCheck | null
}

function useAccountMutation<T>(call: (input: T) => Promise<AccountAnswer>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: call,
    // The variables hold the secrets typed: dropped as soon as nothing watches them
    gcTime: 0,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      // The setup checklist's payment step
      await client.invalidateQueries({ queryKey: ["dashboard", "setup"] })
    },
  })
}

/** Saves after the provider accepted the details; refused ones come back as a 400 with the reason. */
export const useSaveAccount = (provider: string) =>
  useAccountMutation((body: AccountSave) =>
    sdk.client.fetch<AccountAnswer>(accountUrl(provider), { method: "POST", body })
  )

/** "Test the connection" with what is stored. */
export const useCheckAccount = (provider: string) =>
  useAccountMutation(() =>
    sdk.client.fetch<AccountAnswer>(`${accountUrl(provider)}/check`, { method: "POST", body: {} })
  )

export const useRemoveAccount = (provider: string) =>
  useAccountMutation(async () => ({
    ...(await sdk.client.fetch<{ account: ProviderAccount }>(accountUrl(provider), {
      method: "DELETE",
    })),
    check: null,
  }))
