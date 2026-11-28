import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/**
 * Platform support's sessions in this panel (adr/0061 Ek "Destek
 * erişimi"): the grant's redemption on `/support`, and the owner's list
 * under Settings > Security.
 */

/** A redemption refused: the API's key (`support.grant_expired`…), or none. */
export class SupportFailure extends Error {
  constructor(
    readonly status: number,
    readonly key: string | null
  ) {
    super(key ?? `http_${String(status)}`)
  }
}

/** The grant from the link's fragment becomes this browser's session. */
export async function redeemSupportGrant(grant: string): Promise<{ expires_at: string }> {
  const response = await fetch("/auth/support-access", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ grant }),
  })
  const body = (await response.json().catch(() => null)) as {
    code?: unknown
    message?: unknown
    support?: { expires_at: string }
  } | null
  if (!response.ok || !body?.support) {
    const key =
      typeof body?.code === "string"
        ? body.code
        : typeof body?.message === "string"
          ? body.message
          : null
    throw new SupportFailure(response.status, key)
  }
  return body.support
}

export interface SupportSessionRow {
  grant_id: string
  operator_name: string
  reason: string
  started_at: string
  expires_at: string
}

export interface SupportHistoryRow {
  grant_id: string | null
  operator_name: string | null
  reason: string | null
  started_at: string
  expires_at: string | null
  ended_at: string | null
  ended_reason: "logout" | "expired" | "ended_by_owner" | "disabled" | null
}

export interface SupportAccess {
  enabled: boolean
  sessions: SupportSessionRow[]
  history: SupportHistoryRow[]
}

export const SUPPORT_ACCESS_KEY = ["support-access"] as const

export const supportAccessQuery = () =>
  queryOptions({
    queryKey: SUPPORT_ACCESS_KEY,
    queryFn: () => sdk.client.fetch<SupportAccess>("/admin/support-access"),
    refetchInterval: 60_000,
  })

/** An open session ended by the owner now. */
export function useEndSupportSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (grantId: string) =>
      sdk.client.fetch(`/admin/support-access/sessions/${encodeURIComponent(grantId)}/end`, {
        method: "POST",
        body: {},
      }),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: SUPPORT_ACCESS_KEY })
    },
  })
}

/** Whole minutes left until `expiresAt` (never below 0). */
export const minutesLeft = (expiresAt: string, now: number): number =>
  Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60_000))
