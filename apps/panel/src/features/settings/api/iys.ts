import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** How the shop's consents are reaching İYS (F10 M11). */
export interface IysSummary {
  /** Whether the Netgsm account has the shop's İYS brand code. */
  brand_code_set: boolean
  pending: number
  sent: number
  failed: number
}

export const iysSummaryQuery = () =>
  queryOptions({
    queryKey: ["iys", "summary"],
    queryFn: () => sdk.client.fetch<{ iys: IysSummary }>("/admin/messaging/iys"),
  })
