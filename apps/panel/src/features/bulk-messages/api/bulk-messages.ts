import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"
import type {
  AudiencePreview,
  AudienceSource,
  BulkChannel,
  BulkMessage,
  BulkMessageInput,
  BulkMessageList,
  BulkReport,
  BulkStatus,
  TestSendResult,
} from "./types"

export const BULK_PAGE_SIZE = 50

const KEY = "bulk-messages"
const BASE = "/admin/bulk-messages"
const path = (id: string, action?: string) =>
  `${BASE}/${encodeURIComponent(id)}${action ? `/${action}` : ""}`

/** The list, newest first; the status filtered by the server. */
export const bulkMessagesQuery = ({ status, page }: { status: BulkStatus | null; page: number }) =>
  queryOptions({
    queryKey: [KEY, "list", { status, page }],
    queryFn: () =>
      sdk.client.fetch<BulkMessageList>(BASE, {
        query: {
          ...(status ? { status } : {}),
          limit: BULK_PAGE_SIZE,
          offset: page * BULK_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const bulkMessageQuery = (id: string) =>
  queryOptions({
    queryKey: [KEY, "detail", id],
    queryFn: async () => (await sdk.client.fetch<{ campaign: BulkMessage }>(path(id))).campaign,
  })

/** The report; read again every half minute while it sends. */
export const bulkReportQuery = (id: string, live: boolean) =>
  queryOptions({
    queryKey: [KEY, "report", id],
    queryFn: async () =>
      (await sdk.client.fetch<{ report: BulkReport }>(path(id, "report"))).report,
    refetchInterval: live ? 30_000 : false,
  })

/**
 * The live count for the audience being edited. A small budget per staff
 * member on the server (it reads every consent): each choice is asked once
 * a minute at most, the last answer kept on screen while the next comes.
 */
export const audiencePreviewQuery = (
  id: string,
  input: { channel: BulkChannel; audience: AudienceSource[] }
) =>
  queryOptions({
    queryKey: [KEY, "preview", id, input],
    queryFn: () =>
      sdk.client.fetch<AudiencePreview>(path(id, "audience-preview"), {
        method: "POST",
        body: input,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    enabled: input.audience.length > 0,
  })

/** Lists, the campaign and its report read again; never the audience counts (rate-limited). */
function useChanged() {
  const client = useQueryClient()
  return (campaign?: BulkMessage) => {
    if (campaign) {
      client.setQueryData(bulkMessageQuery(campaign.id).queryKey, campaign)
    }
    void client.invalidateQueries({ queryKey: [KEY, "list"] })
    void client.invalidateQueries({ queryKey: [KEY, "report"] })
  }
}

type Created = Pick<BulkMessageInput, "name" | "channel" | "audience">

export function useCreateBulkMessage() {
  const changed = useChanged()
  return useMutation({
    mutationFn: async (input: Created) =>
      (await sdk.client.fetch<{ campaign: BulkMessage }>(BASE, { method: "POST", body: input }))
        .campaign,
    onSuccess: changed,
  })
}

/** A draft saved whole (`AdminUpdateCampaign`); the server refuses one past its draft. */
export function useUpdateBulkMessage(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: async (input: BulkMessageInput) =>
      (
        await sdk.client.fetch<{ campaign: BulkMessage }>(path(id), {
          method: "POST",
          body: input,
        })
      ).campaign,
    onSuccess: changed,
  })
}

export function useDeleteBulkMessage(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: () => sdk.client.fetch(path(id), { method: "DELETE" }),
    onSuccess: () => {
      changed()
    },
  })
}

/** "Kopyala": a new draft with its audience and content. */
export function useCopyBulkMessage(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: async (name?: string) =>
      (
        await sdk.client.fetch<{ campaign: BulkMessage }>(path(id, "copy"), {
          method: "POST",
          body: name ? { name } : {},
        })
      ).campaign,
    onSuccess: changed,
  })
}

/** "Bana gönder": to the signed-in person's own address; nothing else can be asked. */
export function useTestSend(id: string) {
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<TestSendResult>(path(id, "test-send"), { method: "POST", body: {} }),
  })
}

/** "Şimdi gönder": the person proves themselves again (428 → the dialog). */
export function useSendBulkMessage(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: () =>
      withReauth(
        async (extra) =>
          (
            await sdk.client.fetch<{ campaign: BulkMessage }>(path(id, "send"), {
              method: "POST",
              body: {},
              ...extra,
            })
          ).campaign
      ),
    onSuccess: changed,
  })
}

/** "Zamanla": a moment with its offset; proven again like a send. */
export function useScheduleBulkMessage(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: (scheduledAt: string) =>
      withReauth(
        async (extra) =>
          (
            await sdk.client.fetch<{ campaign: BulkMessage }>(path(id, "schedule"), {
              method: "POST",
              body: { scheduled_at: scheduledAt },
              ...extra,
            })
          ).campaign
      ),
    onSuccess: changed,
  })
}

export type BulkAction = "pause" | "resume" | "cancel"

/** Duraklat, sürdür, iptal: the backend asks no proof for these. */
export function useBulkAction(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: async (action: BulkAction) =>
      (
        await sdk.client.fetch<{ campaign: BulkMessage }>(path(id, action), {
          method: "POST",
          body: {},
        })
      ).campaign,
    onSuccess: changed,
  })
}
