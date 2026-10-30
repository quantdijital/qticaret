import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AsyncJob } from "@/features/settings/api/activity"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

export const PRIVACY_KINDS = ["export", "erasure"] as const
export const PRIVACY_CHANNELS = ["email", "phone", "letter", "in_person", "other"] as const

/** A customer's KVKK request (F13.5), as staff recorded and answered it. */
export interface PrivacyRequest {
  id: string
  kind: (typeof PRIVACY_KINDS)[number]
  channel: (typeof PRIVACY_CHANNELS)[number]
  status: "open" | "completed" | "rejected"
  received_at: string
  /** The 30 days the law gives for an answer. */
  due_at: string
  /** An export's job: its file is the answer. */
  job_id: string | null
  completed_at: string | null
}

const key = (customerId: string) => ["customers", "privacy", customerId] as const
const encoded = (id: string) => encodeURIComponent(id)

export const privacyRequestsQuery = (customerId: string) =>
  queryOptions({
    queryKey: key(customerId),
    queryFn: async () =>
      (
        await sdk.client.fetch<{ privacy_requests: PrivacyRequest[] }>(
          `/admin/customers/${encoded(customerId)}/privacy-requests`
        )
      ).privacy_requests,
  })

/** An export's job, looked at again while it runs. */
export const exportJobQuery = (jobId: string) =>
  queryOptions({
    queryKey: ["customers", "privacy", "job", jobId],
    queryFn: async () =>
      (await sdk.client.fetch<{ async_job: AsyncJob }>(`/admin/async-jobs/${encoded(jobId)}`))
        .async_job,
    refetchInterval: (query) =>
      query.state.data?.status === "queued" || query.state.data?.status === "running"
        ? 3000
        : false,
  })

function usePrivacyMutation<T>(customerId: string, run: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: key(customerId) })
    },
  })
}

export const useRecordPrivacyRequest = (customerId: string) =>
  usePrivacyMutation(
    customerId,
    (body: {
      kind: PrivacyRequest["kind"]
      channel: PrivacyRequest["channel"]
      received_at: string
    }) =>
      sdk.client.fetch(`/admin/customers/${encoded(customerId)}/privacy-requests`, {
        method: "POST",
        body,
      })
  )

export const useStartExport = (customerId: string) =>
  usePrivacyMutation(customerId, (requestId: string) =>
    sdk.client.fetch(`/admin/privacy-requests/${encoded(requestId)}/export`, {
      method: "POST",
      body: {},
    })
  )

export const useClosePrivacyRequest = (customerId: string) =>
  usePrivacyMutation(customerId, (input: { id: string; status: "completed" | "rejected" }) =>
    sdk.client.fetch(`/admin/privacy-requests/${encoded(input.id)}/close`, {
      method: "POST",
      body: { status: input.status },
    })
  )

/** The erasure: it cannot be undone, so the person proves themselves again. */
export function useEraseCustomer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      withReauth((extra) =>
        sdk.client.fetch(`/admin/privacy-requests/${encoded(requestId)}/erase`, {
          method: "POST",
          body: {},
          ...extra,
        })
      ),
    onSuccess: async () => {
      // The customer is gone: their page, orders and lists read again
      await client.invalidateQueries({ queryKey: ["customers"] })
      await client.invalidateQueries({ queryKey: ["orders"] })
    },
  })
}
