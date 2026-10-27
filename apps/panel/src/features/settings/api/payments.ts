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

interface AccountsResponse {
  key_configured: boolean
  accounts: ProviderAccount[]
}

export interface PaytrSave {
  settings: { merchant_id: string; test_mode: boolean }
  /** Only the secrets typed in; one left out keeps the stored value. */
  secrets?: { merchant_key?: string; merchant_salt?: string }
}

const ACCOUNTS_KEY = ["settings", "provider-accounts"] as const
const accountUrl = (provider: string) =>
  `/admin/integrations/credentials/${encodeURIComponent(provider)}`

export const providerAccountsQuery = () =>
  queryOptions({
    queryKey: ACCOUNTS_KEY,
    queryFn: () => sdk.client.fetch<AccountsResponse>("/admin/integrations/credentials"),
  })

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
    },
  })
}

/** Saves after PayTR accepted the details; refused ones come back as a 400 with the reason. */
export const useSavePaytr = () =>
  useAccountMutation((body: PaytrSave) =>
    sdk.client.fetch<AccountAnswer>(accountUrl("paytr"), { method: "POST", body })
  )

/** "Test the connection" with what is stored. */
export const useCheckPaytr = () =>
  useAccountMutation(() =>
    sdk.client.fetch<AccountAnswer>(`${accountUrl("paytr")}/check`, { method: "POST", body: {} })
  )

export const useRemovePaytr = () =>
  useAccountMutation(async () => ({
    ...(await sdk.client.fetch<{ account: ProviderAccount }>(accountUrl("paytr"), {
      method: "DELETE",
    })),
    check: null,
  }))
