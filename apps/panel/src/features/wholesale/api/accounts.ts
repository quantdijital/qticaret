import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { refreshStandingAfter } from "@/features/auth/api/staff"
import { responseFailure } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import type {
  AccountStatus,
  AccountsPage,
  CartsRepriced,
  CreateAccountBody,
  CreatedAccount,
  UpdateAccountBody,
  WholesaleAccount,
} from "./types"

/** The wholesalers (ADR-0068 §3), owner and admin only (§9). */

export const ACCOUNTS_PAGE_SIZE = 20
const ROOT = "/admin/wholesale/accounts"
export const WHOLESALE_KEY = ["wholesale"] as const

const at = (id: string) => `${ROOT}/${encodeURIComponent(id)}`

export interface AccountListParams {
  q: string
  status: AccountStatus | "all"
  page: number
}

/** A page of wholesalers, newest first; `q` finds by address, company or contact. */
export const accountsQuery = ({ q, status, page }: AccountListParams) =>
  queryOptions({
    queryKey: [...WHOLESALE_KEY, "accounts", { q, status, page }],
    queryFn: () =>
      sdk.client.fetch<AccountsPage>(ROOT, {
        query: {
          limit: ACCOUNTS_PAGE_SIZE,
          offset: page * ACCOUNTS_PAGE_SIZE,
          ...(q ? { q } : {}),
          ...(status === "all" ? {} : { status }),
        },
      }),
    placeholderData: keepPreviousData,
  })

/** How many wholesalers each tab holds. */
export const accountCountsQuery = () =>
  queryOptions({
    queryKey: [...WHOLESALE_KEY, "accounts", "counts"],
    queryFn: async () => {
      const count = async (status?: AccountStatus) =>
        (
          await sdk.client.fetch<AccountsPage>(ROOT, {
            query: { limit: 1, ...(status ? { status } : {}) },
          })
        ).count
      const [all, active, inactive] = await Promise.all([
        count(),
        count("active"),
        count("inactive"),
      ])
      return { all, active, inactive }
    },
  })

// The wholesale orders' picker reads a shop's wholesalers in one go (the API's page limit)
const ALL_ACCOUNTS = 100

/** Every wholesaler, newest first, for the wholesale orders' picker. */
export const accountOptionsQuery = () =>
  queryOptions({
    queryKey: [...WHOLESALE_KEY, "accounts", "options"],
    queryFn: async () =>
      (await sdk.client.fetch<AccountsPage>(ROOT, { query: { limit: ALL_ACCOUNTS } })).accounts,
  })

export const accountQuery = (id: string) =>
  queryOptions({
    queryKey: [...WHOLESALE_KEY, "account", id],
    queryFn: async () => (await sdk.client.fetch<{ account: WholesaleAccount }>(at(id))).account,
  })

/** Every wholesale change refreshes every wholesale read; a refused one re-reads the role. */
export function useWholesaleMutation<T, R>(run: (input: T) => Promise<R>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onError: (failure) => {
      refreshStandingAfter(client, failure)
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: WHOLESALE_KEY })
    },
  })
}

/** The refusal staff answer with "Hesabı devral": an unconfirmed sign-up at the address. */
export const UNPROVEN_SIGNUP = "wholesale.unproven_signup"

/**
 * A new wholesaler. A plain request, so a refusal's key stays in `code`
 * (`UNPROVEN_SIGNUP` asks staff first); the password goes in the body
 * only, over the session, and is kept nowhere in the panel.
 */
export const useCreateAccount = () =>
  useWholesaleMutation(async (body: CreateAccountBody) => {
    const response = await fetch(ROOT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw await responseFailure(response)
    }
    return (await response.json()) as CreatedAccount
  })

export const useUpdateAccount = (id: string) =>
  useWholesaleMutation((body: UpdateAccountBody) =>
    sdk.client.fetch<{ account: WholesaleAccount }>(at(id), { method: "POST", body })
  )

/** Closed (retail from the next request) or open again; open carts priced again either way. */
export const useSetAccountState = (id: string) =>
  useWholesaleMutation((state: "deactivate" | "reactivate") =>
    sdk.client.fetch<{ account: WholesaleAccount; carts: CartsRepriced }>(`${at(id)}/${state}`, {
      method: "POST",
      body: {},
    })
  )

/** A bound wholesaler's new password, typed by staff; every older sign-in of theirs ends. */
export const useSetAccountPassword = (id: string) =>
  useWholesaleMutation((password: string) =>
    sdk.client.fetch<{ account: WholesaleAccount; signed_out: boolean }>(`${at(id)}/password`, {
      method: "POST",
      body: { password },
    })
  )
