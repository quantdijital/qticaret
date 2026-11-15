import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { refreshStandingAfter } from "@/features/auth/api/staff"
import { responseFailure } from "@/lib/errors"
import { withReauth } from "@/lib/reauth"
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
export function useWholesaleMutation<T, R>(
  run: (input: T) => Promise<R>,
  /** A mutation that carries a password keeps nothing once done (review L8). */
  { secret = false }: { secret?: boolean } = {}
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    ...(secret ? { gcTime: 0 } : {}),
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
  useWholesaleMutation(
    // A take-over replaces someone's password: the API asks staff to prove themselves (428)
    (body: CreateAccountBody) =>
      withReauth(async ({ headers }) => {
        const response = await fetch(ROOT, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          credentials: "include",
          body: JSON.stringify(body),
        })
        if (!response.ok) {
          throw await responseFailure(response)
        }
        return (await response.json()) as CreatedAccount
      }),
    { secret: true }
  )

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
  useWholesaleMutation(
    (password: string) =>
      withReauth((extra) =>
        sdk.client.fetch<{ account: WholesaleAccount; signed_out: boolean }>(`${at(id)}/password`, {
          method: "POST",
          body: { password },
          ...extra,
        })
      ),
    { secret: true }
  )

/**
 * A wholesaler deleted, whatever its state (Ek 2026-11-15 (2)): the
 * wholesale side only; the customer stays a retail customer, and past
 * orders stay wholesale orders. Open carts are priced again at retail.
 */
export const useDeleteAccount = (id: string) =>
  useWholesaleMutation(() =>
    sdk.client.fetch<{ id: string; deleted: boolean; carts: CartsRepriced }>(at(id), {
      method: "DELETE",
    })
  )
