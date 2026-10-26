import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A customer's store credit (F4.8, ADR-0025): one account per currency, credited by the shop. */

const CURRENCY = "try"

export interface StoreCreditAccount {
  id: string
  balance: number
  credits: number
  debits: number
}

export const storeCreditQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["store-credit", customerId],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ store_credit_accounts: StoreCreditAccount[] }>(
          "/admin/store-credit-accounts",
          {
            query: {
              customer_id: customerId,
              currency_code: CURRENCY,
              fields: "id,balance,credits,debits",
            },
          }
        )
      ).store_credit_accounts[0] ?? null,
  })

/** An amount onto the customer's account (a refund, a goodwill gesture); the account is made if new. */
export function useCreditCustomer(customerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: { accountId: string | null; amount: number; note: string }) => {
      const accountId =
        input.accountId ??
        (
          await sdk.client.fetch<{ store_credit_account: { id: string } }>(
            "/admin/store-credit-accounts",
            { method: "POST", body: { currency_code: CURRENCY, customer_id: customerId } }
          )
        ).store_credit_account.id
      await sdk.client.fetch(
        `/admin/store-credit-accounts/${encodeURIComponent(accountId)}/credit`,
        {
          method: "POST",
          body: { amount: input.amount, ...(input.note ? { note: input.note } : {}) },
        }
      )
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ["store-credit", customerId] })
    },
  })
}
