import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** An admin alert (Medusa's `feed` channel): low stock today, more as phases add them. */
export interface AdminNotification {
  id: string
  created_at: string
  data: Record<string, unknown> | null
}

export const notificationsQuery = () =>
  queryOptions({
    queryKey: ["notifications"],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ notifications: AdminNotification[] }>("/admin/notifications", {
          query: { channel: "feed", order: "-created_at", limit: 20, fields: "id,created_at,data" },
        })
      ).notifications,
    // Alerts come from the server's own work: look again now and then
    refetchInterval: 60_000,
  })

const SEEN_KEY = "qt:notifications:seen"

/** When the bell was last opened in this browser; storage may refuse (private mode). */
export function seenAt(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

export function markSeen(at: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(at))
  } catch {
    // Unread counts then start over each visit; nothing else depends on it
  }
}
