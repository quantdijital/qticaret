import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { AI_KEY } from "@/features/ai/api/ai"
import { withReauth } from "@/lib/reauth"
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
/** Aras Kargo on the shop's own contract (adr/0035). */
export type ArasAccount = ProviderAccount<{
  test_mode: boolean
  customer_code: string
  service_url: string
}>
/** The shop's Netgsm SMS account and its sender name (adr/0036). */
export type NetgsmAccount = ProviderAccount<{ msgheader: string; iys_brand_code?: string }>
/** Meta's pixel for server-side events (F10.9); a Test Events code while trying it out. */
export type MetaAccount = ProviderAccount<{ pixel_id: string; test_event_code?: string }>
/** GA4's web stream for server-side events (F10.9). */
export type Ga4Account = ProviderAccount<{ measurement_id: string }>
export type SmtpSecurity = "tls" | "starttls" | "none"
/** The shop's own mail server (adr/0036 Ek 2026-11-10); the password is the one secret. */
export type SmtpAccount = ProviderAccount<{
  host: string
  port: number
  security: SmtpSecurity
  username?: string
  from_email: string
  from_name?: string
  rate_per_minute: number
}>
/** DHL eCommerce (formerly MNG Kargo) on the shop's own contract; the app keys are the platform's. */
export type DhlEcomAccount = ProviderAccount<{ test_mode: boolean }>
/** Yurtiçi Kargo on the shop's own contract, with its door account when it has one (adr/0035). */
export type YurticiAccount = ProviderAccount<{ test_mode: boolean }>

interface AccountsResponse {
  key_configured: boolean
  /** Providers this server cannot connect: the platform's own app with them is not set. */
  unavailable?: string[]
  accounts: ProviderAccount[]
}

export interface AccountSave {
  settings: Record<string, unknown>
  /** Only the secrets typed in; one left out keeps the stored value. */
  secrets?: Record<string, string>
}

export const ACCOUNTS_KEY = ["settings", "provider-accounts"] as const
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
      // An AI service's state is its account's (adr/0071 §3)
      await client.invalidateQueries({ queryKey: AI_KEY })
    },
  })
}

/** Saves after the provider accepted the details; refused ones come back as a 400 with the reason. */
export const useSaveAccount = (provider: string) =>
  useAccountMutation((body: AccountSave) =>
    withReauth((extra) =>
      sdk.client.fetch<AccountAnswer>(accountUrl(provider), { method: "POST", body, ...extra })
    )
  )

/** "Test the connection" with what is stored. */
export const useCheckAccount = (provider: string) =>
  useAccountMutation(() =>
    sdk.client.fetch<AccountAnswer>(`${accountUrl(provider)}/check`, { method: "POST", body: {} })
  )

export const useRemoveAccount = (provider: string) =>
  useAccountMutation(async () => ({
    ...(await withReauth((extra) =>
      sdk.client.fetch<{ account: ProviderAccount }>(accountUrl(provider), {
        method: "DELETE",
        ...extra,
      })
    )),
    check: null,
  }))
