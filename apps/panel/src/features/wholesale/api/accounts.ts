import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { refreshStandingAfter } from "@/features/auth/api/staff"
import { sdk } from "@/lib/sdk"
import type {
  AccountStatus,
  AccountsPage,
  CartsRepriced,
  CreateAccountBody,
  CreatedAccount,
  MessageOutcome,
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
      const [all, pending, active, inactive] = await Promise.all([
        count(),
        count("pending"),
        count("active"),
        count("inactive"),
      ])
      return { all, pending, active, inactive }
    },
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

export const useCreateAccount = () =>
  useWholesaleMutation((body: CreateAccountBody) =>
    sdk.client.fetch<CreatedAccount>(ROOT, { method: "POST", body })
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

export const useResendInvitation = (id: string) =>
  useWholesaleMutation(() =>
    sdk.client.fetch<{ account: WholesaleAccount; message: MessageOutcome }>(
      `${at(id)}/invitation`,
      { method: "POST", body: {} }
    )
  )

/** A pending wholesaler taken back; an active or closed one is closed instead. */
export const useDeleteAccount = (id: string) =>
  useWholesaleMutation(() => sdk.client.fetch<{ id: string }>(at(id), { method: "DELETE" }))
