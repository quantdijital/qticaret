import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** An order the fraud rules held for a person (F15.6, adr/0044 §3). */
export type FraudReviewStatus = "pending" | "approved" | "rejected"
export type FraudRule =
  | "new_customer_high_amount"
  | "address_mismatch"
  | "ip_many_emails"
  | "phone_many_emails"
  | "disposable_email"
  | "failed_payments"

export interface FraudReview {
  id: string
  status: FraudReviewStatus
  score: number
  reasons: { rule: FraudRule; points: number }[]
  note: string | null
  decided_at: string | null
  created_at: string
  order: {
    id: string
    display_id: number
    email: string | null
    /** Kuruş. */
    total: number
    created_at: string
  } | null
}

export const FRAUD_REVIEW_STATUSES: readonly FraudReviewStatus[] = [
  "pending",
  "approved",
  "rejected",
]

const KEY = ["fraud-reviews"] as const

export const FRAUD_PAGE_SIZE = 50

export const fraudReviewsQuery = (filters: { status: FraudReviewStatus; page?: number }) =>
  queryOptions({
    queryKey: [...KEY, filters],
    queryFn: () =>
      sdk.client.fetch<{ reviews: FraudReview[]; count: number }>("/admin/fraud/reviews", {
        query: {
          status: filters.status,
          limit: FRAUD_PAGE_SIZE,
          offset: (filters.page ?? 0) * FRAUD_PAGE_SIZE,
        },
      }),
  })

/** Approve a held order (it may ship) or turn it down (it stays held until cancelled). */
export function useDecideReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: "approved" | "rejected" }) =>
      sdk.client.fetch(`/admin/fraud/reviews/${encodeURIComponent(id)}/decision`, {
        method: "POST",
        body,
      }),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: KEY })
      await client.invalidateQueries({ queryKey: ["orders"] })
    },
  })
}
