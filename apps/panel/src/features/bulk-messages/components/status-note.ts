import type { TFunction } from "i18next"
import type { BulkMessage } from "@/features/bulk-messages/api/types"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const B = "bulkMessages"

type Stated = Pick<BulkMessage, "status" | "paused_reason" | "scheduled_at"> & {
  failure_reason?: string | null
}

/**
 * Why it waits, why it failed, or when it goes: one sentence under the
 * title, none for a state that says it all. A failure the panel has no
 * words for reads as the general one.
 */
export function statusNote(t: TFunction, campaign: Stated): string | null {
  if (campaign.status === "paused" && campaign.paused_reason) {
    return t(`${B}.pause.${campaign.paused_reason}`)
  }
  if (campaign.status === "failed") {
    const key = (campaign.failure_reason ?? "").replace(/^campaigns\./, "")
    return t(`${B}.failure.${key === "" ? "generic" : key}`, {
      defaultValue: t(`${B}.failure.generic`),
    })
  }
  if (campaign.status === "scheduled" && campaign.scheduled_at) {
    return t(`${B}.scheduledFor`, { when: formatDateTime(campaign.scheduled_at) })
  }
  return null
}
