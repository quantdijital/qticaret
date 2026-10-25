import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import type { PeriodKey } from "@/features/dashboard/period"
import { sdk } from "@/lib/sdk"

/** `GET /admin/reports/sales`: the dashboard's numbers with every product and category sold. */
export const salesReportQuery = (period: PeriodKey) =>
  queryOptions({
    queryKey: ["reports", "sales", period],
    queryFn: () =>
      sdk.client.fetch<DashboardOverview>("/admin/reports/sales", { query: { period } }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
