import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import type { ReportRange } from "@/features/reports/range"
import { sdk } from "@/lib/sdk"

/**
 * `GET /admin/reports/sales`: the dashboard's numbers with every product
 * and category sold, over a preset period or the days asked for (F11.1).
 */
export const salesReportQuery = (range: ReportRange) =>
  queryOptions({
    queryKey: ["reports", "sales", range],
    queryFn: () => sdk.client.fetch<DashboardOverview>("/admin/reports/sales", { query: range }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
